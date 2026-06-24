export const api = {
  get: async <T = any>(url: string): Promise<{ data: T }> => {
    const res = await fetch(url);
    if (!res.ok) {
      let errMsg = res.statusText;
      try {
        const errData = await res.json();
        errMsg = errData.error || errData.message || res.statusText;
      } catch (e) {}
      throw new Error(errMsg);
    }
    const data = await res.json();
    return { data };
  },
  post: async <T = any>(url: string, body?: any): Promise<{ data: T }> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let errMsg = res.statusText;
      try {
        const errData = await res.json();
        errMsg = errData.error || errData.message || res.statusText;
      } catch (e) {}
      throw new Error(errMsg);
    }
    const data = await res.json();
    return { data };
  },
  delete: async <T = any>(url: string): Promise<{ data: T }> => {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      let errMsg = res.statusText;
      try {
        const errData = await res.json();
        errMsg = errData.error || errData.message || res.statusText;
      } catch (e) {}
      throw new Error(errMsg);
    }
    const data = await res.json();
    return { data };
  },
};
export default api;
