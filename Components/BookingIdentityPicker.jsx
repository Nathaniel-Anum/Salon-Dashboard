import React, { useEffect, useState } from "react";
import { Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import { FiCheck, FiMail, FiPhone, FiSearch, FiUser, FiUserPlus, FiUsers } from "react-icons/fi";
import _axios from "../src/api/_axios.js";
import { firstApiErrorMessage } from "../src/api/apiErrors.js";
import { searchGuestCustomers } from "../src/api/guestCustomers.js";
import { permissionState } from "../src/auth/permissions.js";
import "./BookingIdentityPicker.css";

const MODES = [
  { key: "registered", label: "Registered", icon: <FiUser aria-hidden="true" /> },
  { key: "guest", label: "Saved guest", icon: <FiUsers aria-hidden="true" /> },
  { key: "new_guest", label: "New guest", icon: <FiUserPlus aria-hidden="true" /> },
];

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function registeredName(customer = {}) {
  return customer.full_name
    || [customer.first_name, customer.last_name].filter(Boolean).join(" ")
    || customer.name
    || `Customer #${customer.id}`;
}

function contactLine(record = {}) {
  return record.phone_number || record.phone || record.email || "No contact details";
}

function ResultButton({ active, badge, name, contact, meta, onClick }) {
  return (
    <button type="button" className={`identity-result${active ? " is-selected" : ""}`} onClick={onClick}>
      <span className="identity-result-avatar" aria-hidden="true">{String(name).trim().charAt(0).toUpperCase()}</span>
      <span className="identity-result-copy">
        <span className="identity-result-name">
          {name}
          {badge && <span className="identity-kind-badge">{badge}</span>}
        </span>
        <span className="identity-result-contact">{contact}</span>
        {meta && <span className="identity-result-meta">{meta}</span>}
      </span>
      {active && <FiCheck className="identity-result-check" aria-label="Selected" />}
    </button>
  );
}

export default function BookingIdentityPicker({ value, onChange, initialKind = "registered" }) {
  const [mode, setMode] = useState(value?.kind || initialKind);
  const [registeredSearch, setRegisteredSearch] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const debouncedRegisteredSearch = useDebouncedValue(registeredSearch);
  const debouncedGuestSearch = useDebouncedValue(guestSearch);
  const canViewGuests = permissionState("customers.view") !== false;

  const registeredQuery = useQuery({
    queryKey: ["booking-registered-customers", debouncedRegisteredSearch],
    queryFn: ({ signal }) => _axios.get("/api/portal/v1/accounts/customers/", {
      params: debouncedRegisteredSearch.trim() ? { search: debouncedRegisteredSearch.trim() } : {},
      signal,
      portalMessage: false,
    }).then((response) => Array.isArray(response.data) ? response.data : (response.data?.results ?? [])),
    enabled: mode === "registered",
    staleTime: 30_000,
  });

  const trimmedGuestSearch = debouncedGuestSearch.trim();
  const guestQuery = useQuery({
    queryKey: ["booking-guest-customers", trimmedGuestSearch],
    queryFn: ({ signal }) => searchGuestCustomers(trimmedGuestSearch, signal),
    enabled: mode === "guest" && canViewGuests && trimmedGuestSearch.length >= 2,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const registeredCustomers = registeredQuery.data ?? [];
  const savedGuests = guestQuery.data ?? [];

  const switchMode = (nextMode) => {
    setMode(nextMode);
    onChange(nextMode === "new_guest"
      ? { kind: "new_guest", fullName: "", email: "", phoneNumber: "" }
      : null);
  };

  const updateNewGuest = (field, fieldValue) => {
    onChange({
      kind: "new_guest",
      fullName: value?.kind === "new_guest" ? value.fullName : "",
      email: value?.kind === "new_guest" ? value.email : "",
      phoneNumber: value?.kind === "new_guest" ? value.phoneNumber : "",
      [field]: fieldValue,
    });
  };

  return (
    <section className="booking-identity-picker" aria-label="Customer identity">
      <div className="identity-mode-tabs" role="tablist" aria-label="Customer type">
        {MODES.map(({ key, label, icon }) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={mode === key}
            className={mode === key ? "is-active" : ""}
            onClick={() => switchMode(key)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {mode === "registered" && (
        <div className="identity-search-panel" role="tabpanel">
          <label className="identity-search-field">
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              value={registeredSearch}
              onChange={(event) => setRegisteredSearch(event.target.value)}
              placeholder="Search registered customers"
            />
          </label>
          <div className="identity-results" aria-live="polite">
            {registeredQuery.isFetching && !registeredCustomers.length ? (
              <div className="identity-feedback"><Spin size="small" /> Loading customers…</div>
            ) : registeredQuery.isError ? (
              <div className="identity-feedback is-error">{firstApiErrorMessage(registeredQuery.error, "Customers could not be loaded.")}</div>
            ) : registeredCustomers.length ? registeredCustomers.map((customer) => {
              const name = registeredName(customer);
              return (
                <ResultButton
                  key={`registered-${customer.id}`}
                  active={value?.kind === "registered" && String(value.id) === String(customer.id)}
                  name={name}
                  contact={contactLine(customer)}
                  onClick={() => onChange({ kind: "registered", id: Number(customer.id), label: name, customer })}
                />
              );
            }) : (
              <div className="identity-feedback">No registered customers found.</div>
            )}
          </div>
        </div>
      )}

      {mode === "guest" && (
        <div className="identity-search-panel" role="tabpanel">
          {!canViewGuests ? (
            <div className="identity-feedback is-error">You do not have permission to search saved guests.</div>
          ) : (
            <>
              <label className="identity-search-field">
                <FiSearch aria-hidden="true" />
                <input
                  type="search"
                  value={guestSearch}
                  onChange={(event) => setGuestSearch(event.target.value)}
                  placeholder="Search name, phone, or email"
                />
              </label>
              <div className="identity-results" aria-live="polite">
                {trimmedGuestSearch.length < 2 ? (
                  <div className="identity-feedback">Enter at least 2 characters to search saved guests.</div>
                ) : guestQuery.isFetching ? (
                  <div className="identity-feedback"><Spin size="small" /> Searching guests…</div>
                ) : guestQuery.isError ? (
                  <div className="identity-feedback is-error">{firstApiErrorMessage(guestQuery.error, "Saved guests could not be loaded.")}</div>
                ) : savedGuests.length ? savedGuests.map((guest) => (
                  <ResultButton
                    key={`guest-${guest.id}`}
                    active={value?.kind === "guest" && String(value.id) === String(guest.id)}
                    badge="Guest"
                    name={guest.full_name || `Guest #${guest.id}`}
                    contact={contactLine(guest)}
                    meta={guest.appointment_count
                      ? `${guest.appointment_count} previous appointment${guest.appointment_count === 1 ? "" : "s"}`
                      : "No appointment history"}
                    onClick={() => onChange({
                      kind: "guest",
                      id: Number(guest.id),
                      label: guest.full_name || `Guest #${guest.id}`,
                      guest,
                    })}
                  />
                )) : (
                  <div className="identity-feedback">
                    <span>No saved guest matches this search.</span>
                    <button type="button" onClick={() => switchMode("new_guest")}>Enter a new guest</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {mode === "new_guest" && (
        <div className="new-guest-fields" role="tabpanel">
          <label>
            <span>Full name <strong>*</strong></span>
            <input
              type="text"
              autoComplete="name"
              value={value?.kind === "new_guest" ? value.fullName : ""}
              onChange={(event) => updateNewGuest("fullName", event.target.value)}
              placeholder="e.g. Efua Owusu"
            />
          </label>
          <div className="new-guest-contact-grid">
            <label>
              <span><FiPhone aria-hidden="true" /> Phone</span>
              <input
                type="tel"
                autoComplete="tel"
                value={value?.kind === "new_guest" ? value.phoneNumber : ""}
                onChange={(event) => updateNewGuest("phoneNumber", event.target.value)}
                placeholder="e.g. 055 123 4567"
              />
            </label>
            <label>
              <span><FiMail aria-hidden="true" /> Email</span>
              <input
                type="email"
                autoComplete="email"
                value={value?.kind === "new_guest" ? value.email : ""}
                onChange={(event) => updateNewGuest("email", event.target.value)}
                placeholder="efua@example.com"
              />
            </label>
          </div>
          <p className="identity-contact-hint">Add a phone number or email so this guest can be found next time.</p>
        </div>
      )}
    </section>
  );
}
