import { useEffect, useMemo, useState } from "react";
import { Alert, Button, DatePicker, Dropdown, Empty, Form, Input, Modal, Select, Skeleton, Switch, TimePicker, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock, FiEdit3, FiPlus, FiRepeat, FiTrash2, FiUmbrella } from "react-icons/fi";
import _axios from "../src/api/_axios.js";
import {
  bookingV2Keys, createDatedShift, createRepeatingShift, createTimeOff,
  deleteDatedShift, deleteRepeatingShift, deleteTimeOff, listDatedShifts,
  listFrom, listRepeatingShifts, listTimeOffs, repeatingShiftDay,
  timeOffCoversDate, updateRepeatingShift, updateTimeOff,
} from "../src/api/bookingV2.js";
import { firstApiErrorMessage } from "../src/api/apiErrors.js";
import { permissionState } from "../src/auth/permissions.js";
import { useBookingV2 } from "../src/hooks/useBookingV2.js";
import "./ScheduleV2Page.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const REASONS = { annual_leave: "Annual leave", sick_leave: "Sick leave", training: "Training", other: "Time off" };
const ADD_ITEMS = [{ key: "dated", label: "Add shift", icon: <FiCalendar /> }, { key: "repeating", label: "Add repeating shift", icon: <FiRepeat /> }, { key: "timeoff", label: "Add time off", icon: <FiUmbrella /> }];
const staffIdOf = (record) => record?.staff_id ?? record?.staff?.id ?? record?.staff;
const staffName = (person) => person?.full_name || person?.name || `Team member #${person?.id}`;
const rolesOf = (person) => (person?.roles || []).map((role) => role?.name || role?.label || role).filter(Boolean).join(", ") || "No role assigned";
const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const timePart = (value) => String(value || "").includes("T") ? String(value).slice(11, 16) : String(value || "").slice(0, 5);
const clock = (value) => timePart(value) || "—";
const minutes = (start, end) => {
  const [sh = 0, sm = 0] = timePart(start).split(":").map(Number);
  const [eh = 0, em = 0] = timePart(end).split(":").map(Number);
  return Math.max(0, eh * 60 + em - sh * 60 - sm);
};
const hours = (value) => value ? `${Math.floor(value / 60)}h${value % 60 ? ` ${value % 60}m` : ""}` : "No shifts";
const apiMessage = (error, fallback) => firstApiErrorMessage(error, fallback);

function rangeFor(view, cursor) {
  if (view === "day") return { start: cursor.startOf("day"), end: cursor.startOf("day") };
  if (view === "month") {
    const first = cursor.startOf("month");
    const start = first.subtract((first.day() + 6) % 7, "day");
    const last = cursor.endOf("month");
    return { start, end: last.add((7 - last.day()) % 7, "day") };
  }
  const start = cursor.subtract((cursor.day() + 6) % 7, "day");
  return { start, end: start.add(6, "day") };
}

function recordForDay(personId, date, dated, repeating, timeOffs) {
  const iso = date.format("YYYY-MM-DD");
  const blocked = timeOffs.find((row) => String(staffIdOf(row)) === String(personId) && timeOffCoversDate(row, iso));
  const datedRows = dated.filter((row) => String(staffIdOf(row)) === String(personId) && String(row.date || row.starts_at).slice(0, 10) === iso);
  const repeatingRows = repeating.flatMap((rule) => {
    if (String(staffIdOf(rule)) !== String(personId)) return [];
    const day = repeatingShiftDay(rule, iso);
    return day ? [{ ...day, id: `repeat-${rule.id}-${iso}`, rule, kind: "repeating" }] : [];
  });
  return { blocked, working: [...datedRows.map((row) => ({ ...row, kind: "dated" })), ...repeatingRows] };
}

function ShiftDialog({ open, onClose, onSaved, onPartial, staff, staffId, date, timezone }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [failures, setFailures] = useState([]);
  const selectedStaffId = staffId ?? staff[0]?.id;
  const initial = { staff_id: selectedStaffId, date, timezone, times: [{ start_time: dayjs("2000-01-01T09:00"), end_time: dayjs("2000-01-01T17:00") }], notes: "" };
  useEffect(() => { if (open) form.setFieldsValue({ staff_id: selectedStaffId, date, timezone }); }, [date, form, open, selectedStaffId, timezone]);
  async function submit(values) {
    if (!values.times.every((row) => row.start_time && row.end_time && row.end_time.isAfter(row.start_time))) return setFailures(["Each end time must be after its start time."]);
    const ordered = values.times.map((row) => [row.start_time.valueOf(), row.end_time.valueOf()]).sort((a, b) => a[0] - b[0]);
    if (ordered.some((row, index) => index > 0 && row[0] < ordered[index - 1][1])) return setFailures(["Times for the same day cannot overlap."]);
    setSaving(true);
    const payloads = values.times.map((row) => ({ staff_id: values.staff_id, date: values.date.format("YYYY-MM-DD"), start_time: row.start_time.format("HH:mm"), end_time: row.end_time.format("HH:mm"), timezone: values.timezone, notes: values.notes || "" }));
    const results = await Promise.allSettled(payloads.map(createDatedShift));
    const failedIndexes = results.flatMap((result, index) => result.status === "rejected" ? [index] : []);
    const failed = failedIndexes.map((index) => apiMessage(results[index].reason, "This time conflicts with another shift."));
    setSaving(false);
    if (failed.length) {
      form.setFieldValue("times", failedIndexes.map((index) => values.times[index]));
      setFailures([`${payloads.length - failed.length} time${payloads.length - failed.length === 1 ? " was" : "s were"} saved. Correct the remaining row${failed.length === 1 ? "" : "s"}.`, ...failed]);
      return onPartial();
    }
    message.success(payloads.length > 1 ? "Shifts added." : "Shift added.");
    form.resetFields();
    onSaved();
  }
  return <Modal title="Add dated shift" open={open} onCancel={onClose} footer={null} destroyOnHidden><Form form={form} layout="vertical" initialValues={initial} onFinish={submit} clearOnDestroy>
    {failures.length > 0 && <Alert type="error" showIcon message="Some times could not be saved" description={failures.join(" ")} />}
    <div className="shift-form-pair"><Form.Item name="staff_id" label="Team member" rules={[{ required: true }]}><Select options={staff.map((person) => ({ value: person.id, label: staffName(person) }))} /></Form.Item><Form.Item name="date" label="Date" rules={[{ required: true }]}><DatePicker /></Form.Item></div>
    <Form.List name="times">{(fields, { add, remove }) => <>{fields.map((field, index) => <div className="shift-time-row" key={field.key}><Form.Item name={[field.name, "start_time"]} label={index ? undefined : "Starts"} rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={15} /></Form.Item><Form.Item name={[field.name, "end_time"]} label={index ? undefined : "Ends"} rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={15} /></Form.Item>{fields.length > 1 && <Button aria-label="Remove time" icon={<FiTrash2 />} onClick={() => remove(field.name)} />}</div>)}<Button type="dashed" icon={<FiPlus />} onClick={() => add({ start_time: dayjs("2000-01-01T09:00"), end_time: dayjs("2000-01-01T17:00") })}>Add another time</Button></>}</Form.List>
    <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item><Form.Item name="timezone" hidden><Input /></Form.Item><div className="shift-modal-actions"><Button onClick={onClose}>Cancel</Button><Button type="primary" htmlType="submit" loading={saving}>Save shift</Button></div>
  </Form></Modal>;
}

function RepeatingDialog({ open, onClose, onSaved, staff, staffId, date, timezone, editing }) {
  const [form] = Form.useForm();
  const selectedStaffId = editing ? staffIdOf(editing) : staffId ?? staff[0]?.id;
  const initial = { staff_id: selectedStaffId, frequency_weeks: 1, start_date: date || dayjs(), no_end: true, timezone, is_active: true, notes: "", days: DAYS.map((_, day) => ({ day_of_week: day, is_available: day < 5, start_time: day < 5 ? dayjs("2000-01-01T09:00") : null, end_time: day < 5 ? dayjs("2000-01-01T17:00") : null })) };
  const values = editing ? { ...editing, staff_id: staffIdOf(editing), start_date: dayjs(editing.start_date), end_date: editing.end_date ? dayjs(editing.end_date) : null, no_end: !editing.end_date, days: DAYS.map((_, day) => { const row = editing.days?.find((item) => Number(item.day_of_week) === day); return { day_of_week: day, is_available: Boolean(row?.is_available), start_time: row?.start_time ? dayjs(`2000-01-01T${row.start_time}`) : null, end_time: row?.end_time ? dayjs(`2000-01-01T${row.end_time}`) : null }; }) } : initial;
  useEffect(() => { if (open) form.setFieldsValue({ staff_id: selectedStaffId, ...(!editing && date ? { start_date: date } : {}) }); }, [date, editing, form, open, selectedStaffId]);
  const mutation = useMutation({ mutationFn: (payload) => editing ? updateRepeatingShift(editing.id, payload) : createRepeatingShift(payload), onSuccess: () => { message.success(editing ? "Repeating shift updated." : "Repeating shift added."); onSaved(); }, onError: (error) => message.error(apiMessage(error, "The repeating shift could not be saved.")) });
  const submit = (value) => {
    if (!value.days.some((day) => day.is_available)) return message.error("Enable at least one weekday.");
    if (value.days.some((day) => day.is_available && (!day.start_time || !day.end_time || !day.end_time.isAfter(day.start_time)))) return message.error("Each enabled day needs an end time after its start time.");
    mutation.mutate({ staff_id: value.staff_id, frequency_weeks: value.frequency_weeks, start_date: value.start_date.format("YYYY-MM-DD"), end_date: value.no_end ? null : value.end_date?.format("YYYY-MM-DD"), timezone: value.timezone, is_active: value.is_active, notes: value.notes || "", days: value.days.map((row, day) => ({ day_of_week: day, is_available: Boolean(row.is_available), start_time: row.is_available ? row.start_time?.format("HH:mm") : null, end_time: row.is_available ? row.end_time?.format("HH:mm") : null })) });
  };
  const title = <div className="repeat-modal__header"><span className="repeat-modal__icon"><FiRepeat /></span><div><h2>{editing ? "Edit repeating shift" : "Create a repeating shift"}</h2><p>Set the working pattern once and it will appear on the schedule automatically.</p></div></div>;
  return <Modal className="repeat-modal" title={title} open={open} onCancel={onClose} footer={null} width={820} destroyOnHidden><Form form={form} layout="vertical" initialValues={values} onFinish={submit} clearOnDestroy>
    <div className="repeat-modal__layout">
      <section className="repeat-modal__details" aria-labelledby="repeat-details-title">
        <div className="repeat-modal__section-heading"><FiCalendar /><div><h3 id="repeat-details-title">Schedule details</h3><p>Who this pattern belongs to and how long it runs.</p></div></div>
        <Form.Item name="staff_id" label="Team member" rules={[{ required: true }]}><Select options={staff.map((person) => ({ value: person.id, label: staffName(person) }))} /></Form.Item>
        <Form.Item name="frequency_weeks" label="Repeat pattern"><Select options={[1,2,3,4].map((value) => ({ value, label: value === 1 ? "Every week" : `Every ${value} weeks` }))} /></Form.Item>
        <div className="repeat-modal__dates"><Form.Item name="start_date" label="Starts on" rules={[{ required: true }]}><DatePicker /></Form.Item><Form.Item noStyle shouldUpdate>{({ getFieldValue }) => !getFieldValue("no_end") && <Form.Item name="end_date" label="Ends on" rules={[{ required: true }]}><DatePicker /></Form.Item>}</Form.Item></div>
        <div className="repeat-modal__options"><label><Form.Item name="no_end" valuePropName="checked" noStyle><Switch size="small" /></Form.Item><span><strong>No end date</strong><small>Keep this pattern running</small></span></label><label><Form.Item name="is_active" valuePropName="checked" noStyle><Switch size="small" /></Form.Item><span><strong>Active</strong><small>Use it for availability</small></span></label></div>
        <Form.Item className="repeat-modal__notes" name="notes" label="Notes (optional)"><Input.TextArea rows={3} placeholder="Add a note for your team" /></Form.Item>
      </section>
      <section className="repeat-modal__week" aria-labelledby="repeat-week-title">
        <div className="repeat-modal__section-heading"><FiClock /><div><h3 id="repeat-week-title">Weekly hours</h3><p>Turn on each working day and set its hours.</p></div></div>
        <div className="shift-repeat-days"><Form.List name="days">{(fields) => fields.map((field, day) => <Form.Item noStyle shouldUpdate={(before, after) => before.days?.[day]?.is_available !== after.days?.[day]?.is_available} key={field.key}>{({ getFieldValue }) => {
          const enabled = getFieldValue(["days", day, "is_available"]);
          return <div className={`shift-repeat-day${enabled ? " is-enabled" : ""}`}><Form.Item name={[field.name, "is_available"]} valuePropName="checked"><Switch size="small" aria-label={`Enable ${DAYS[day]}`} /></Form.Item><span className="shift-repeat-day__name"><b>{DAYS[day].slice(0, 3)}</b><strong>{DAYS[day]}</strong></span>{enabled ? <div className="shift-repeat-day__times"><Form.Item name={[field.name, "start_time"]} rules={[{ required: true }]}><TimePicker aria-label={`${DAYS[day]} start time`} format="HH:mm" minuteStep={15} /></Form.Item><span>to</span><Form.Item name={[field.name, "end_time"]} rules={[{ required: true }]}><TimePicker aria-label={`${DAYS[day]} end time`} format="HH:mm" minuteStep={15} /></Form.Item></div> : <span className="shift-repeat-day__off">Not working</span>}</div>;
        } }</Form.Item>)}</Form.List></div>
      </section>
    </div>
    <Form.Item name="timezone" hidden><Input /></Form.Item><div className="shift-modal-actions repeat-modal__actions"><Button onClick={onClose}>Cancel</Button><Button type="primary" htmlType="submit" loading={mutation.isPending}>{editing ? "Save changes" : "Create repeating shift"}</Button></div>
  </Form></Modal>;
}

function TimeOffDialog({ open, onClose, onSaved, staff, staffId, date, timezone, editing }) {
  const [form] = Form.useForm();
  const selectedStaffId = editing ? staffIdOf(editing) : staffId ?? staff[0]?.id;
  const initial = editing ? { ...editing, staff_id: selectedStaffId, start_date: dayjs(editing.start_date), end_date: editing.end_date ? dayjs(editing.end_date) : null } : { staff_id: selectedStaffId, reason_type: "annual_leave", start_date: date || dayjs(), end_date: date || dayjs(), repeat: false, active: true, timezone };
  useEffect(() => { if (open) form.setFieldsValue({ staff_id: selectedStaffId, ...(!editing && date ? { start_date: date, end_date: date } : {}) }); }, [date, editing, form, open, selectedStaffId]);
  const mutation = useMutation({ mutationFn: (payload) => editing ? updateTimeOff(editing.id, payload) : createTimeOff(payload), onSuccess: () => { message.success(editing ? "Time off updated." : "Time off added."); onSaved(); }, onError: (error) => message.error(apiMessage(error, "Time off could not be saved.")) });
  const submit = (value) => {
    if (value.end_date?.isBefore(value.start_date, "day")) return message.error("The last day cannot be before the first day.");
    mutation.mutate({ staff_id: value.staff_id, reason_type: value.reason_type, reason: value.reason || "", start_date: value.start_date.format("YYYY-MM-DD"), end_date: value.end_date?.format("YYYY-MM-DD") || null, repeat: value.repeat, active: value.active, timezone: value.timezone });
  };
  return <Modal title={editing ? "Edit time off" : "Add time off"} open={open} onCancel={onClose} footer={null} destroyOnHidden><Form form={form} layout="vertical" initialValues={initial} onFinish={submit} clearOnDestroy>
    <div className="shift-form-pair"><Form.Item name="staff_id" label="Team member" rules={[{ required: true }]}><Select options={staff.map((person) => ({ value: person.id, label: staffName(person) }))} /></Form.Item><Form.Item name="reason_type" label="Reason"><Select options={Object.entries(REASONS).map(([value,label]) => ({ value,label }))} /></Form.Item></div>
    <div className="shift-form-pair"><Form.Item name="start_date" label="First day" rules={[{ required: true }]}><DatePicker /></Form.Item><Form.Item name="end_date" label="Last day (inclusive)"><DatePicker /></Form.Item></div>
    <div className="shift-switches"><Form.Item><Form.Item name="repeat" valuePropName="checked" noStyle><Switch aria-label="Repeat annually" /></Form.Item> <span>Repeat annually</span></Form.Item><Form.Item><Form.Item name="active" valuePropName="checked" noStyle><Switch aria-label="Active" /></Form.Item> <span>Active</span></Form.Item></div>
    <Form.Item name="reason" label="Explanation"><Input.TextArea rows={2} /></Form.Item><Form.Item name="timezone" hidden><Input /></Form.Item><div className="shift-modal-actions"><Button onClick={onClose}>Cancel</Button><Button type="primary" htmlType="submit" loading={mutation.isPending}>Save time off</Button></div>
  </Form></Modal>;
}

function ShiftBlocks({ state, canEdit, onAdd, onDelete, onEdit, personId, date }) {
  if (state.blocked) return <div className="shift-block blocked"><FiUmbrella /><strong>{REASONS[state.blocked.reason_type] || "Time off"}</strong><span>{state.blocked.reason || "Not available"}</span>{canEdit && <button aria-label="Edit time off" onClick={() => onEdit("timeoff", state.blocked)}><FiEdit3 /></button>}</div>;
  if (!state.working.length) return canEdit ? <Dropdown menu={{ items: ADD_ITEMS, onClick: ({ key }) => onAdd(key, personId, date) }} trigger={["click"]}><button type="button" className="shift-block off">Not working <FiChevronDown /></button></Dropdown> : <div className="shift-block off">Not working</div>;
  return state.working.map((row) => <div className={`shift-block ${row.kind}`} key={row.id}><span className="shift-block__type">{row.kind === "repeating" ? <><FiRepeat /> Repeating</> : "Dated shift"}</span><strong>{clock(row.start_time || row.starts_at)}–{clock(row.end_time || row.ends_at)}</strong>{row.notes && <small>{row.notes}</small>}{canEdit && (row.kind === "dated" ? <button aria-label="Delete dated shift" onClick={() => onDelete("dated", row)}><FiTrash2 /></button> : <button aria-label="Edit repeating shift" onClick={() => onEdit("repeating", row.rule)}><FiEdit3 /></button>)}</div>);
}

export default function ScheduleV2Page() {
  const queryClient = useQueryClient();
  const { timezone } = useBookingV2();
  const [view, setView] = useState("week");
  const [cursor, setCursor] = useState(dayjs());
  const [staffFilter, setStaffFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState({ staffId: null, date: dayjs(), fromCalendar: false });
  const canView = permissionState("staff_schedule.view") !== false;
  const canEdit = permissionState("staff_schedule.edit") !== false;
  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const filters = useMemo(() => ({ starts_on: range.start.format("YYYY-MM-DD"), ends_on: range.end.format("YYYY-MM-DD"), ...(staffFilter !== "all" ? { staff_id: staffFilter } : {}) }), [range, staffFilter]);
  const staffParams = staffFilter !== "all" ? { staff_id: staffFilter } : undefined;
  const staffQ = useQuery({ queryKey: ["staff"], queryFn: () => _axios.get("/api/portal/v1/accounts/staff/").then((response) => listFrom(response.data)), enabled: canView, staleTime: 300_000 });
  const shiftsQ = useQuery({ queryKey: bookingV2Keys.datedShifts(filters), queryFn: () => listDatedShifts(filters).then(listFrom), enabled: canView, staleTime: 15_000 });
  const repeatingQ = useQuery({ queryKey: bookingV2Keys.repeatingShifts(staffParams || {}), queryFn: () => listRepeatingShifts(staffParams).then(listFrom), enabled: canView, staleTime: 30_000 });
  const timeOffQ = useQuery({ queryKey: bookingV2Keys.timeOffs(staffParams || {}), queryFn: () => listTimeOffs(staffParams).then(listFrom), enabled: canView, staleTime: 30_000 });
  const staff = staffQ.data || [];
  const shownStaff = staffFilter === "all" ? staff : staff.filter((person) => String(person.id) === String(staffFilter));
  const dates = useMemo(() => Array.from({ length: range.end.diff(range.start, "day") + 1 }, (_, index) => range.start.add(index, "day")), [range]);
  const loading = staffQ.isLoading || shiftsQ.isLoading || repeatingQ.isLoading || timeOffQ.isLoading;
  const error = staffQ.error || shiftsQ.error || repeatingQ.error || timeOffQ.error;
  async function invalidate() {
    await Promise.all([["booking-v2", "shifts"], ["booking-v2", "repeating-shifts"], ["booking-v2", "time-offs"], ["booking-v2", "availability"], ["booking-v2", "appointments"], ["appointments"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  }
  const removeM = useMutation({ mutationFn: ({ kind, id }) => kind === "dated" ? deleteDatedShift(id) : kind === "repeating" ? deleteRepeatingShift(id) : deleteTimeOff(id), onSuccess: () => { message.success("Schedule updated."); invalidate(); }, onError: (err) => message.error(apiMessage(err, "The schedule could not be updated.")) });
  const remove = (kind, record) => Modal.confirm({ title: kind === "timeoff" ? "Delete this time off?" : "Delete this shift?", content: "This change takes effect in availability immediately.", okText: "Delete", okButtonProps: { danger: true }, onOk: () => removeM.mutateAsync({ kind, id: record.id }) });
  const openAdd = (key, personId = staffFilter === "all" ? staff[0]?.id : staffFilter, date = cursor) => { setEditing(null); setPrefill({ staffId: personId, date, fromCalendar: false }); setDialog(key); };
  const openCalendarAdd = (key, personId, date) => { setEditing(null); setPrefill({ staffId: personId, date, fromCalendar: true }); setDialog(key); };
  const openEdit = (kind, record) => { setEditing(record); setDialog(kind); };
  const saved = async () => { await invalidate(); setDialog(null); setEditing(null); };
  const step = view === "day" ? "day" : view === "month" ? "month" : "week";
  const title = view === "day" ? cursor.format("dddd, D MMMM YYYY") : view === "month" ? cursor.format("MMMM YYYY") : `${range.start.format("D MMM")} – ${range.end.format("D MMM YYYY")}`;
  if (!canView) return <main className="shift-studio"><Alert type="warning" showIcon message="Schedule access required" description="Ask an administrator for the staff_schedule.view permission." /></main>;
  return <main className="shift-studio">
    <header className="shift-studio__header"><div><h1>Staff schedule</h1><p>See every team member’s working hours and leave in one place. Availability is always confirmed by the booking engine.</p></div></header>
    <section className="shift-workspace"><div className="shift-toolbar"><div className="shift-view-switch">{["day","week","month"].map((item) => <button className={view === item ? "active" : ""} key={item} onClick={() => setView(item)}>{item}</button>)}</div><div className="shift-nav"><Button icon={<FiChevronLeft />} aria-label={`Previous ${step}`} onClick={() => setCursor(cursor.subtract(1, step))} /><button className="shift-nav__today" onClick={() => setCursor(dayjs())}>Today</button><strong>{title}</strong><Button icon={<FiChevronRight />} aria-label={`Next ${step}`} onClick={() => setCursor(cursor.add(1, step))} /></div><div className="shift-toolbar__actions"><Select value={staffFilter} onChange={setStaffFilter} options={[{ value: "all", label: "Everyone" }, ...staff.map((person) => ({ value: person.id, label: staffName(person) }))]} />{canEdit && <Dropdown menu={{ items: ADD_ITEMS, onClick: ({ key }) => openAdd(key) }}><Button type="primary" icon={<FiPlus />}>Add</Button></Dropdown>}</div></div>
      <div className="shift-legend"><span><i className="dated" />Dated shift</span><span><i className="repeating" />Repeating shift</span><span><i className="blocked" />Time off overrides work</span></div>
      {loading ? <div className="shift-roster-loading"><Skeleton active paragraph={{ rows: 8 }} /></div> : error ? <Alert type="error" showIcon message="The staff schedule could not be loaded" description={apiMessage(error, "Refresh and try again.")} /> : view === "month" ? <MonthView dates={dates} cursor={cursor} staff={shownStaff} shifts={shiftsQ.data || []} repeating={repeatingQ.data || []} timeOffs={timeOffQ.data || []} onAdd={openAdd} /> : <Roster dates={dates} staff={shownStaff} shifts={shiftsQ.data || []} repeating={repeatingQ.data || []} timeOffs={timeOffQ.data || []} view={view} canEdit={canEdit} onAdd={openCalendarAdd} onDelete={remove} onEdit={openEdit} />}
    </section>
    <Rules staff={staff} repeating={repeatingQ.data || []} timeOffs={timeOffQ.data || []} canEdit={canEdit} onEdit={openEdit} onDelete={remove} />
    <ShiftDialog open={dialog === "dated"} onClose={() => setDialog(null)} onSaved={saved} onPartial={invalidate} staff={staff} staffId={prefill.staffId} date={prefill.date} timezone={timezone} />
    <RepeatingDialog open={dialog === "repeating"} onClose={() => setDialog(null)} onSaved={saved} staff={staff} staffId={prefill.staffId} date={prefill.fromCalendar ? prefill.date : null} timezone={timezone} editing={editing} />
    <TimeOffDialog open={dialog === "timeoff"} onClose={() => setDialog(null)} onSaved={saved} staff={staff} staffId={prefill.staffId} date={prefill.fromCalendar ? prefill.date : null} timezone={timezone} editing={editing} />
  </main>;
}

function Roster({ dates, staff, shifts, repeating, timeOffs, view, canEdit, onAdd, onDelete, onEdit }) {
  return <div className="shift-roster-scroll"><table className="shift-roster"><thead><tr><th className="shift-roster__person-heading"><strong>Team member</strong><span>{staff.length} shown</span></th>{dates.map((date) => <th className={date.isSame(dayjs(),"day") ? "today" : ""} key={date.format("YYYY-MM-DD")}><span>{date.format("ddd")}</span><strong>{date.format("D MMM")}</strong></th>)}</tr></thead><tbody>{staff.map((person) => { const states = dates.map((date) => recordForDay(person.id, date, shifts, repeating, timeOffs)); const total = states.reduce((sum, state) => sum + (state.blocked ? 0 : state.working.reduce((value,row) => value + minutes(row.start_time || row.starts_at, row.end_time || row.ends_at),0)),0); return <tr key={person.id}><th className="shift-roster__person"><span className="shift-roster__avatar">{initials(staffName(person))}</span><span className="shift-roster__identity"><strong>{staffName(person)}</strong><small>{rolesOf(person)}</small><em>{hours(total)} {view === "week" ? "this week" : "scheduled"}</em></span></th>{states.map((state,index) => <td className={dates[index].isSame(dayjs(),"day") ? "today" : ""} key={dates[index].format("YYYY-MM-DD")}><ShiftBlocks state={state} canEdit={canEdit} onAdd={onAdd} onDelete={onDelete} onEdit={onEdit} personId={person.id} date={dates[index]} /></td>)}</tr>; })}</tbody></table>{!staff.length && <Empty description="No team members found" />}</div>;
}

function MonthView({ dates, cursor, staff, shifts, repeating, timeOffs, onAdd }) {
  return <div className="shift-month"><div className="shift-month__weekdays">{DAYS.map((day) => <strong key={day}>{day.slice(0,3)}</strong>)}</div><div className="shift-month__grid">{dates.map((date) => { const records = staff.map((person) => ({ person, state: recordForDay(person.id, date, shifts, repeating, timeOffs) })).filter(({ state }) => state.blocked || state.working.length); return <button className={`${date.month() !== cursor.month() ? "outside" : ""} ${date.isSame(dayjs(), "day") ? "today" : ""}`} key={date.format("YYYY-MM-DD")} onClick={() => onAdd("dated", staff[0]?.id, date)}><time>{date.date()}</time>{records.slice(0,3).map(({ person, state }) => <span className={state.blocked ? "blocked" : state.working[0]?.kind} key={person.id}>{staffName(person)} · {state.blocked ? REASONS[state.blocked.reason_type] : `${clock(state.working[0].start_time || state.working[0].starts_at)}–${clock(state.working[0].end_time || state.working[0].ends_at)}`}</span>)}{records.length > 3 && <small>+{records.length - 3} more</small>}</button>; })}</div></div>;
}

function Rules({ staff, repeating, timeOffs, canEdit, onEdit, onDelete }) {
  return <section className="shift-rules"><header><h2>Schedule rules</h2><p>Edit recurring hours and planned leave without searching the calendar.</p></header><div className="shift-rules__grid"><div><h3><FiRepeat /> Repeating shifts</h3>{repeating.length ? repeating.map((rule) => <article key={rule.id}><span><strong>{staffName(staff.find((person) => String(person.id) === String(staffIdOf(rule))))}</strong><small>Every {rule.frequency_weeks} week{Number(rule.frequency_weeks) > 1 ? "s" : ""} · {rule.is_active ? "Active" : "Inactive"}</small></span>{canEdit && <span><Button icon={<FiEdit3 />} onClick={() => onEdit("repeating", rule)} /><Button danger icon={<FiTrash2 />} onClick={() => onDelete("repeating", rule)} /></span>}</article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No repeating shifts" />}</div><div><h3><FiUmbrella /> Time off</h3>{timeOffs.length ? timeOffs.map((row) => <article className={!row.active ? "inactive" : ""} key={row.id}><span><strong>{staffName(staff.find((person) => String(person.id) === String(staffIdOf(row))))}</strong><small>{REASONS[row.reason_type]} · {row.start_date} to {row.end_date || row.start_date}</small></span>{canEdit && <span><Button icon={<FiEdit3 />} onClick={() => onEdit("timeoff", row)} /><Button danger icon={<FiTrash2 />} onClick={() => onDelete("timeoff", row)} /></span>}</article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No time off" />}</div></div></section>;
}
