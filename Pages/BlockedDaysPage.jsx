import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit3,
  FiPlus,
  FiSlash,
  FiTag,
  FiUnlock,
  FiX,
} from "react-icons/fi";
import { message, Spin } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  fetchBlockedDays,
  blockPeriod,
  updatePeriod,
  unblockPeriod,
} from "../src/api/blockedDays";
import "./BlockedDaysPage.css";

const REASON_PRESETS = [
  { label: "Public holiday", value: "Public Holiday", tone: "blue" },
  { label: "Staff training", value: "Staff Training", tone: "green" },
  { label: "Personal day", value: "Personal Day", tone: "amber" },
  { label: "Deep cleaning", value: "Deep Cleaning", tone: "violet" },
  { label: "Maintenance", value: "Maintenance", tone: "red" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateStr(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: mondayFirstOffset }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sortPeriods(periods) {
  return [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
}

function dateCount(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  return dayjs(endDate).diff(dayjs(startDate), "day") + 1;
}

function formatPeriod(startDate, endDate, includeYear = true) {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  if (startDate === endDate) {
    return start.format(includeYear ? "dddd, D MMMM YYYY" : "dddd, D MMMM");
  }
  if (start.year() === end.year() && start.month() === end.month()) {
    return `${start.format("D")}–${end.format(includeYear ? "D MMMM YYYY" : "D MMMM")}`;
  }
  return `${start.format(includeYear ? "D MMM YYYY" : "D MMM")} – ${end.format(
    includeYear ? "D MMM YYYY" : "D MMM",
  )}`;
}

function getReasonState(reason) {
  if (!reason) return { selectedReason: "", customReason: "" };
  const isPreset = REASON_PRESETS.some((preset) => preset.value === reason);
  return isPreset
    ? { selectedReason: reason, customReason: "" }
    : { selectedReason: "custom", customReason: reason };
}

function CalendarMonth({
  year,
  month,
  todayStr,
  rangeStart,
  rangeEnd,
  findPeriodForDate,
  onDayClick,
}) {
  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const sortedSelection = rangeStart && rangeEnd ? [rangeStart, rangeEnd].sort() : [];
  const selectionStart = sortedSelection[0];
  const selectionEnd = sortedSelection[1];

  return (
    <section className="bdp-month" aria-label={monthLabel}>
      <h2 className="bdp-month__title">{monthLabel}</h2>
      <div className="bdp-month__weekdays" aria-hidden="true">
        {DAY_LABELS.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="bdp-month__grid">
        {cells.map((day, index) => {
          if (!day) return <span className="bdp-day bdp-day--empty" key={`empty-${index}`} />;

          const dateStr = toDateStr(year, month, day);
          const date = dayjs(dateStr);
          const period = findPeriodForDate(dateStr);
          const isBlocked = Boolean(period);
          const isSelected = Boolean(
            selectionStart && selectionEnd && dateStr >= selectionStart && dateStr <= selectionEnd,
          );
          const previousPeriod = findPeriodForDate(date.subtract(1, "day").format("YYYY-MM-DD"));
          const nextPeriod = findPeriodForDate(date.add(1, "day").format("YYYY-MM-DD"));
          const showReason = isBlocked && (
            period.start_date === dateStr || date.day() === 1 || day === 1
          );
          const classNames = [
            "bdp-day",
            dateStr < todayStr && "bdp-day--past",
            dateStr === todayStr && "bdp-day--today",
            isBlocked && "bdp-day--blocked",
            isSelected && "bdp-day--selected",
            dateStr === selectionStart && "bdp-day--selection-start",
            dateStr === selectionEnd && "bdp-day--selection-end",
            isBlocked && date.day() !== 1 && previousPeriod?.id === period?.id && "bdp-day--continues-left",
            isBlocked && date.day() !== 0 && nextPeriod?.id === period?.id && "bdp-day--continues-right",
          ].filter(Boolean).join(" ");
          const blockedLabel = period?.reason ? ` Closed: ${period.reason}.` : " Closed.";

          return (
            <button
              aria-label={`${date.format("dddd, D MMMM YYYY")}.${isBlocked ? blockedLabel : ""}`}
              aria-pressed={isSelected}
              className={classNames}
              disabled={dateStr < todayStr}
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              type="button"
            >
              <span className="bdp-day__number">{day}</span>
              {showReason && <span className="bdp-day__event-label">{period.reason || "Closed"}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function BlockedDaysPage() {
  const queryClient = useQueryClient();
  const today = useMemo(() => dayjs().startOf("day"), []);
  const todayStr = today.format("YYYY-MM-DD");
  const [blockedPeriods, setBlockedPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(today.startOf("month"));
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [awaitingRangeEnd, setAwaitingRangeEnd] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [pendingUnblock, setPendingUnblock] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchBlockedDays()
      .then((periods) => {
        if (mounted) setBlockedPeriods(sortPeriods(periods));
      })
      .catch(() => {
        if (mounted) message.error("Blocked dates could not be loaded. Refresh to try again.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!pendingUnblock) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !savingAction) setPendingUnblock(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingUnblock, savingAction]);

  const findPeriodForDate = useCallback(
    (dateStr) => blockedPeriods.find(
      (period) => dateStr >= period.start_date && dateStr <= period.end_date,
    ),
    [blockedPeriods],
  );

  const selectPeriod = useCallback((period) => {
    const reasonState = getReasonState(period.reason);
    setRangeStart(period.start_date);
    setRangeEnd(period.end_date);
    setAwaitingRangeEnd(false);
    setSelectedPeriodId(period.id);
    setReason(reasonState.selectedReason);
    setCustomReason(reasonState.customReason);
    setVisibleMonth(dayjs(period.start_date).startOf("month"));
  }, []);

  const selectNewRange = useCallback((startDate, endDate = startDate, chooseEnd = false) => {
    setRangeStart(startDate);
    setRangeEnd(endDate);
    setAwaitingRangeEnd(chooseEnd);
    setSelectedPeriodId(null);
    setReason("");
    setCustomReason("");
    setVisibleMonth(dayjs(startDate).startOf("month"));
  }, []);

  const clearSelection = useCallback(() => {
    setRangeStart(null);
    setRangeEnd(null);
    setAwaitingRangeEnd(false);
    setSelectedPeriodId(null);
    setReason("");
    setCustomReason("");
  }, []);

  const nextAvailableDate = useCallback(() => {
    for (let offset = 0; offset < 366; offset += 1) {
      const candidate = today.add(offset, "day").format("YYYY-MM-DD");
      if (!findPeriodForDate(candidate)) return candidate;
    }
    return todayStr;
  }, [findPeriodForDate, today, todayStr]);

  const handleDayClick = useCallback((dateStr) => {
    const existingPeriod = findPeriodForDate(dateStr);
    if (existingPeriod) {
      selectPeriod(existingPeriod);
      return;
    }
    if (awaitingRangeEnd && rangeStart && selectedPeriodId === null) {
      const [startDate, endDate] = [rangeStart, dateStr].sort();
      setRangeStart(startDate);
      setRangeEnd(endDate);
      setAwaitingRangeEnd(false);
      return;
    }
    selectNewRange(dateStr, dateStr, true);
  }, [awaitingRangeEnd, findPeriodForDate, rangeStart, selectNewRange, selectPeriod, selectedPeriodId]);

  const overlappingPeriod = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    return blockedPeriods.find((period) => (
      period.id !== selectedPeriodId
      && rangeStart <= period.end_date
      && rangeEnd >= period.start_date
    ));
  }, [blockedPeriods, rangeEnd, rangeStart, selectedPeriodId]);

  const duration = dateCount(rangeStart, rangeEnd);
  const hasSelection = Boolean(rangeStart && rangeEnd);
  const isEditing = selectedPeriodId !== null;
  const saveDisabled = !hasSelection
    || Boolean(overlappingPeriod)
    || (reason === "custom" && !customReason.trim())
    || Boolean(savingAction);

  const updateStartDate = (value) => {
    if (!value) return;
    setRangeStart(value);
    if (!rangeEnd || rangeEnd < value) setRangeEnd(value);
    setAwaitingRangeEnd(false);
    setVisibleMonth(dayjs(value).startOf("month"));
  };

  const updateEndDate = (value) => {
    if (!value) return;
    setRangeEnd(value < rangeStart ? rangeStart : value);
    setAwaitingRangeEnd(false);
  };

  const handleSave = async () => {
    if (saveDisabled) return;
    const finalReason = reason === "custom" ? customReason.trim() : reason;
    setSavingAction("save");
    try {
      if (isEditing) {
        const updated = await updatePeriod(selectedPeriodId, rangeStart, rangeEnd, finalReason);
        setBlockedPeriods((periods) => sortPeriods(
          periods.map((period) => period.id === updated.id ? updated : period),
        ));
        message.success(`${formatPeriod(rangeStart, rangeEnd, false)} updated.`);
      } else {
        const created = await blockPeriod(rangeStart, rangeEnd, finalReason);
        setBlockedPeriods((periods) => sortPeriods([...periods, created]));
        message.success(`${formatPeriod(rangeStart, rangeEnd, false)} blocked for new bookings.`);
      }
      queryClient.invalidateQueries({ queryKey: ["blocked-days"] });
      clearSelection();
    } catch {
      message.error(isEditing
        ? "The closure could not be updated. Try again."
        : "The dates could not be blocked. Try again.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleConfirmUnblock = async () => {
    if (!pendingUnblock) return;
    const period = pendingUnblock;
    setSavingAction(`unblock-${period.id}`);
    try {
      await unblockPeriod(period.id);
      setBlockedPeriods((periods) => periods.filter((item) => item.id !== period.id));
      queryClient.invalidateQueries({ queryKey: ["blocked-days"] });
      if (selectedPeriodId === period.id) clearSelection();
      setPendingUnblock(null);
      message.success(`${formatPeriod(period.start_date, period.end_date, false)} reopened for bookings.`);
    } catch {
      message.error("These dates could not be reopened. Try again.");
    } finally {
      setSavingAction(null);
    }
  };

  const upcomingPeriods = useMemo(
    () => blockedPeriods.filter((period) => period.end_date >= todayStr),
    [blockedPeriods, todayStr],
  );
  const pastPeriods = useMemo(
    () => blockedPeriods.filter((period) => period.end_date < todayStr).reverse(),
    [blockedPeriods, todayStr],
  );
  const periodGroups = useMemo(() => {
    const thisMonthEnd = today.endOf("month").format("YYYY-MM-DD");
    return [
      {
        label: "In progress",
        periods: upcomingPeriods.filter(
          (period) => period.start_date <= todayStr && period.end_date >= todayStr,
        ),
      },
      {
        label: "This month",
        periods: upcomingPeriods.filter(
          (period) => period.start_date > todayStr && period.start_date <= thisMonthEnd,
        ),
      },
      {
        label: "Later",
        periods: upcomingPeriods.filter((period) => period.start_date > thisMonthEnd),
      },
    ].filter((group) => group.periods.length > 0);
  }, [today, todayStr, upcomingPeriods]);

  const secondMonth = visibleMonth.add(1, "month");
  const tomorrowStr = today.add(1, "day").format("YYYY-MM-DD");
  const weekendStart = today.add((6 - today.day() + 7) % 7, "day");
  const weekendEnd = weekendStart.add(1, "day");

  const renderPeriodRow = (period, isPast = false) => {
    const startsToday = period.start_date === todayStr;
    const inProgress = period.start_date < todayStr && period.end_date >= todayStr;
    const reasonState = REASON_PRESETS.find((preset) => preset.value === period.reason);
    const rowDuration = dateCount(period.start_date, period.end_date);
    return (
      <article className={`bdp-period-row${isPast ? " bdp-period-row--past" : ""}`} key={period.id}>
        <button className="bdp-period-row__main" onClick={() => selectPeriod(period)} type="button">
          <span className="bdp-period-row__date">
            <strong>{dayjs(period.start_date).format("D")}</strong>
            <span>{dayjs(period.start_date).format("MMM")}</span>
          </span>
          <span className="bdp-period-row__copy">
            <span className="bdp-period-row__title">
              {formatPeriod(period.start_date, period.end_date, false)}
            </span>
            <span className="bdp-period-row__meta">
              {period.reason && <i className={`bdp-reason-dot bdp-reason-dot--${reasonState?.tone || "neutral"}`} />}
              {period.reason || "No reason added"}<span aria-hidden="true">•</span>
              {rowDuration} {rowDuration === 1 ? "day" : "days"}
            </span>
          </span>
          {!isPast && (startsToday || inProgress) && (
            <span className="bdp-period-row__status">{inProgress ? "In progress" : "Today"}</span>
          )}
          <span className="bdp-period-row__edit"><FiEdit3 aria-hidden="true" /> Edit</span>
        </button>
        {!isPast && (
          <button className="bdp-period-row__reopen" onClick={() => setPendingUnblock(period)} type="button">
            <FiUnlock aria-hidden="true" /><span>Reopen</span>
          </button>
        )}
      </article>
    );
  };

  const openNextAvailable = () => {
    const date = nextAvailableDate();
    selectNewRange(date, date, true);
  };

  return (
    <main className="bdp-page">
      <header className="bdp-page-header">
        <div>
          <div className="bdp-page-header__title-row">
            <span className="bdp-page-header__icon"><FiSlash aria-hidden="true" /></span>
            <h1>Salon closures</h1>
          </div>
          <p>Prevent new bookings on days when the salon is unavailable.</p>
        </div>
        <button className="bdp-button bdp-button--primary bdp-page-header__action" onClick={openNextAvailable} type="button">
          <FiPlus aria-hidden="true" /> <span>Block dates</span>
        </button>
      </header>

      <div className="bdp-planner">
        <section className="bdp-calendar-card" aria-label="Closure calendar">
          <div className="bdp-calendar-toolbar">
            <div>
              <h2>Plan closures</h2>
              <p>Select one date, then optionally choose another to create a range.</p>
            </div>
            <div className="bdp-calendar-toolbar__actions">
              <button className="bdp-button bdp-button--quiet" onClick={() => setVisibleMonth(today.startOf("month"))} type="button">Today</button>
              <div className="bdp-month-nav" aria-label="Change visible months">
                <button aria-label="Previous month" onClick={() => setVisibleMonth((month) => month.subtract(1, "month"))} type="button"><FiChevronLeft /></button>
                <button aria-label="Next month" onClick={() => setVisibleMonth((month) => month.add(1, "month"))} type="button"><FiChevronRight /></button>
              </div>
            </div>
          </div>
          <div className="bdp-calendar-legend" aria-label="Calendar legend">
            <span><i className="bdp-legend-dot bdp-legend-dot--selected" /> Selected</span>
            <span><i className="bdp-legend-dot bdp-legend-dot--closed" /> Closed</span>
            <span><i className="bdp-legend-ring" /> Today</span>
          </div>
          {loading ? <div className="bdp-calendar-loading"><Spin /></div> : (
            <div className="bdp-calendar-months">
              <CalendarMonth year={visibleMonth.year()} month={visibleMonth.month()} todayStr={todayStr} rangeStart={rangeStart} rangeEnd={rangeEnd} findPeriodForDate={findPeriodForDate} onDayClick={handleDayClick} />
              <CalendarMonth year={secondMonth.year()} month={secondMonth.month()} todayStr={todayStr} rangeStart={rangeStart} rangeEnd={rangeEnd} findPeriodForDate={findPeriodForDate} onDayClick={handleDayClick} />
            </div>
          )}
        </section>

        <aside className={`bdp-editor${hasSelection ? " bdp-editor--active" : ""}`} aria-label="Closure details">
          {!hasSelection ? (
            <div className="bdp-editor-empty">
              <span className="bdp-editor-empty__icon"><FiCalendar /></span>
              <h2>Choose when you’re closed</h2>
              <p>Select a date on the calendar or start with a common choice.</p>
              <div className="bdp-quick-actions">
                <button onClick={() => selectNewRange(todayStr, todayStr, true)} type="button">Today <span>{today.format("D MMM")}</span></button>
                <button onClick={() => selectNewRange(tomorrowStr, tomorrowStr, true)} type="button">Tomorrow <span>{today.add(1, "day").format("D MMM")}</span></button>
                <button onClick={() => selectNewRange(weekendStart.format("YYYY-MM-DD"), weekendEnd.format("YYYY-MM-DD"))} type="button">This weekend <span>{weekendStart.format("D")}–{weekendEnd.format("D MMM")}</span></button>
              </div>
            </div>
          ) : (
            <>
              <div className="bdp-editor__header">
                <div>
                  <span className="bdp-editor__mode">{isEditing ? "Editing closure" : "New closure"}</span>
                  <h2>{formatPeriod(rangeStart, rangeEnd)}</h2>
                </div>
                <button className="bdp-icon-button" aria-label="Close editor" onClick={clearSelection} type="button"><FiX /></button>
              </div>
              <div className="bdp-editor__body">
                {awaitingRangeEnd && !isEditing && (
                  <div className="bdp-context-note" role="status"><FiClock /><span>This day is ready to block. Choose another date to extend the range.</span></div>
                )}
                <fieldset className="bdp-fieldset">
                  <legend>Dates</legend>
                  <div className="bdp-date-fields">
                    <label><span>Start date</span><input min={todayStr} onChange={(event) => updateStartDate(event.target.value)} type="date" value={rangeStart} /></label>
                    <label><span>End date</span><input min={rangeStart || todayStr} onChange={(event) => updateEndDate(event.target.value)} type="date" value={rangeEnd} /></label>
                  </div>
                  <p className="bdp-duration"><FiClock /> {duration} {duration === 1 ? "day" : "days"}</p>
                </fieldset>
                {overlappingPeriod && (
                  <div className="bdp-overlap-warning" role="alert">
                    <FiAlertCircle />
                    <div><strong>These dates overlap an existing closure.</strong><span>{formatPeriod(overlappingPeriod.start_date, overlappingPeriod.end_date, false)}</span><button onClick={() => selectPeriod(overlappingPeriod)} type="button">Edit that closure</button></div>
                  </div>
                )}
                <fieldset className="bdp-fieldset">
                  <legend><FiTag /> Reason <span>Optional</span></legend>
                  <div className="bdp-reason-options">
                    {REASON_PRESETS.map((preset) => (
                      <button className={reason === preset.value ? "is-selected" : ""} key={preset.value} onClick={() => setReason(reason === preset.value ? "" : preset.value)} type="button">
                        <i className={`bdp-reason-dot bdp-reason-dot--${preset.tone}`} />{preset.label}{reason === preset.value && <FiCheck />}
                      </button>
                    ))}
                    <button className={reason === "custom" ? "is-selected" : ""} onClick={() => setReason(reason === "custom" ? "" : "custom")} type="button"><i className="bdp-reason-dot bdp-reason-dot--neutral" />Other{reason === "custom" && <FiCheck />}</button>
                  </div>
                  {reason === "custom" && (
                    <label className="bdp-custom-reason"><span>Reason</span><input autoFocus maxLength={120} onChange={(event) => setCustomReason(event.target.value)} placeholder="For example, owner’s wedding" type="text" value={customReason} /></label>
                  )}
                </fieldset>
              </div>
              <div className="bdp-editor__footer">
                {isEditing && (
                  <button className="bdp-button bdp-button--danger-quiet" onClick={() => setPendingUnblock(blockedPeriods.find((period) => period.id === selectedPeriodId))} type="button"><FiUnlock /> Reopen dates</button>
                )}
                <button className="bdp-button bdp-button--primary bdp-editor__save" disabled={saveDisabled} onClick={handleSave} type="button">
                  {savingAction === "save" ? <Spin size="small" /> : (isEditing ? "Save changes" : `Block ${duration} ${duration === 1 ? "day" : "days"}`)}
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      <section className="bdp-upcoming" aria-labelledby="upcoming-closures-heading">
        <div className="bdp-section-heading">
          <div><h2 id="upcoming-closures-heading">Upcoming closures</h2><p>Review, edit or reopen dates from one place.</p></div>
          <span className="bdp-count">{upcomingPeriods.length}</span>
        </div>
        {loading ? <div className="bdp-list-loading"><Spin /></div> : upcomingPeriods.length === 0 ? (
          <div className="bdp-empty-list">
            <span><FiCheck /></span><div><h3>No upcoming closures</h3><p>The salon is currently available for bookings every day.</p></div>
            <button className="bdp-button bdp-button--quiet" onClick={openNextAvailable} type="button"><FiPlus /> Block dates</button>
          </div>
        ) : (
          <div className="bdp-period-groups">
            {periodGroups.map((group) => <div className="bdp-period-group" key={group.label}><h3>{group.label}</h3><div>{group.periods.map((period) => renderPeriodRow(period))}</div></div>)}
          </div>
        )}
        {!loading && pastPeriods.length > 0 && (
          <details className="bdp-history"><summary><span>Past closures ({pastPeriods.length})</span><FiChevronDown /></summary><div>{pastPeriods.map((period) => renderPeriodRow(period, true))}</div></details>
        )}
      </section>

      {pendingUnblock && (
        <div className="bdp-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingAction) setPendingUnblock(null); }}>
          <section aria-describedby="reopen-dialog-description" aria-labelledby="reopen-dialog-title" aria-modal="true" className="bdp-dialog" role="dialog">
            <span className="bdp-dialog__icon"><FiUnlock /></span>
            <h2 id="reopen-dialog-title">Reopen these dates?</h2>
            <p id="reopen-dialog-description">{formatPeriod(pendingUnblock.start_date, pendingUnblock.end_date)} will become available for new bookings.</p>
            <div className="bdp-dialog__actions">
              <button className="bdp-button bdp-button--quiet" disabled={Boolean(savingAction)} onClick={() => setPendingUnblock(null)} type="button">Keep closed</button>
              <button className="bdp-button bdp-button--reopen" disabled={Boolean(savingAction)} onClick={handleConfirmUnblock} type="button">{savingAction ? <Spin size="small" /> : <><FiUnlock /> Reopen dates</>}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
