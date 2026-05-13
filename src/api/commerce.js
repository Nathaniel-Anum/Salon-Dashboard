import _axios from "./_axios";

/* ─── Categories ─── */
export const getCategories = () =>
  _axios.get("/api/portal/v1/commerce/categories/").then((r) => r.data);
export const createCategory = (data) =>
  _axios.post("/api/portal/v1/commerce/categories/", data, {
    headers:
      data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {},
  });
export const updateCategory = (id, data) =>
  _axios.patch(`/api/portal/v1/commerce/categories/${id}/`, data);
export const deleteCategory = (id) =>
  _axios.delete(`/api/portal/v1/commerce/categories/${id}/`);

/* ─── Products ─── */
export const getProducts = () =>
  _axios.get("/api/portal/v1/commerce/products/").then((r) => r.data);
export const createProduct = (data) =>
  _axios.post("/api/portal/v1/commerce/products/", data);
export const updateProduct = (id, data) =>
  _axios.patch(`/api/portal/v1/commerce/products/${id}/`, data);
export const deleteProduct = (id) =>
  _axios.delete(`/api/portal/v1/commerce/products/${id}/`);

/* ─── Inventory ─── */
export const getInventory = () =>
  _axios.get("/api/portal/v1/commerce/inventory/").then((r) => r.data);
export const createInventory = (data) =>
  _axios.post("/api/portal/v1/commerce/inventory/", data);
export const updateInventory = (id, data) =>
  _axios.patch(`/api/portal/v1/commerce/inventory/${id}/`, data);
export const deleteInventory = (id) =>
  _axios.delete(`/api/portal/v1/commerce/inventory/${id}/`);

/* ─── Orders ─── */
export const getOrders = () =>
  _axios.get("/api/portal/v1/commerce/orders/").then((r) => r.data);
export const createOrder = (data) =>
  _axios.post("/api/portal/v1/commerce/orders/", data);
export const getOrder = (id) =>
  _axios.get(`/api/portal/v1/commerce/orders/${id}/`).then((r) => r.data);
export const confirmOrder = (id) =>
  _axios.post(`/api/portal/v1/commerce/orders/${id}/confirm/`);
export const completeOrder = (id) =>
  _axios.post(`/api/portal/v1/commerce/orders/${id}/complete/`);
export const cancelOrder = (id) =>
  _axios.post(`/api/portal/v1/commerce/orders/${id}/cancel/`);
