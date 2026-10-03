export function filterCustomers(customers = [], search = "") {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return customers;

  return customers.filter((customer) => [
    customer.full_name,
    customer.first_name,
    customer.last_name,
    [customer.first_name, customer.last_name].filter(Boolean).join(" "),
    customer.email,
    customer.phone,
    customer.phone_number,
  ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query)));
}
