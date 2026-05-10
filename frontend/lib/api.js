export const API_URL = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

export async function fetchSongMetadata(url) {
  const response = await fetch(`${API_URL}/api/metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not read this link.");
  return data;
}

export async function submitWeddingProject(payload, filesByRitual) {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  Object.entries(filesByRitual).forEach(([ritual, files]) => {
    files.forEach((file, index) => form.append(`mp3:${ritual}::${index}`, file));
  });

  const response = await fetch(`${API_URL}/api/submissions`, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Submission failed.");
  return data;
}

export async function fetchAdminProjects() {
  const response = await fetch(`${API_URL}/api/admin/projects`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Admin access failed.");
  return data.projects;
}

export async function deleteAdminProject(id) {
  const response = await fetch(`${API_URL}/api/admin/projects/${id}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Delete failed.");
  }
}
