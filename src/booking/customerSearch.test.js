import assert from "node:assert/strict";
import test from "node:test";
import { filterCustomers } from "./customerSearch.js";

const customers = [
  { id: 1, first_name: "Ama", last_name: "Mensah", email: "ama@example.com", phone: "0551234567" },
  { id: 2, full_name: "Kojo Asare", email: "kojo@example.com", phone_number: "0240000000" },
];

test("filters registered customers by name and contact details", () => {
  assert.deepEqual(filterCustomers(customers, "  AMA MENSAH ").map(({ id }) => id), [1]);
  assert.deepEqual(filterCustomers(customers, "0240").map(({ id }) => id), [2]);
  assert.deepEqual(filterCustomers(customers, "nobody"), []);
});
