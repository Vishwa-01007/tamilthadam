const API_BASE_URL = "https://tamilthadam-1.onrender.com";

export function apiFetch(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
  });
}
