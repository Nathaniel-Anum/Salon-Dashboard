import test from "node:test";
import assert from "node:assert/strict";
import { serviceFormValues } from "./serviceForm.js";

test("duplicate keeps service data but removes nested option ids", () => {
  const service = {
    id: 7,
    name: "Silk Press",
    description: "Wash and finish",
    duration: 90,
    price: "250.00",
    price_type: "fixed",
    is_active: true,
    category: 3,
    assigned_staff_ids: [11, 12],
    service_options: [{ id: 44, name: "Long hair", price: "300.00", duration: 120, description: "", is_active: true }],
  };

  const duplicate = serviceFormValues(service, true);

  assert.equal(duplicate.name, service.name);
  assert.deepEqual(duplicate.staff_ids, [11, 12]);
  assert.equal(duplicate.service_options[0].name, "Long hair");
  assert.equal("id" in duplicate.service_options[0], false);
  assert.equal("id" in serviceFormValues(service).service_options[0], true);
});
