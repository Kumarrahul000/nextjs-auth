import { getToken } from "next-auth/jwt";
import { baseURL } from "@/lib/config";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE"];
const REQUEST_TIMEOUT = 30000; // 30 seconds

export default async function handler(req, res) {
  const { method, body, query } = req;

  if (!ALLOWED_METHODS.includes(method)) {
    return res.status(405).json({
      error: `Method ${method} not allowed`,
    });
  }

  try {
    // Verify authentication
    const session = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!session?.access_token) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    // Validate API path
    const slug = query.slug ?? [];
    delete query.slug;
    const apiPath = Array.isArray(slug) ? slug.join("/") : null;
    if (!apiPath) {
      return res.status(400).json({
        error: "Invalid API path",
      });
    }

    // Build query string
    const { page = 1, limit = 25, search = "", ...filters } = query;
    const queryParams = new URLSearchParams({
      page,
      page_size: limit,
      ...(search && { search }),
      ...filters,
    });

    const apiUrl = `${baseURL}/api/${apiPath}/?${queryParams.toString()}`;

    // Configure fetch options
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };

    const fetchOptions = {
      method,
      headers,
      ...(method !== "GET" && { body: JSON.stringify(body) }),
    };

    // Add timeout support
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    fetchOptions.signal = controller.signal;

    // Make API request
    const response = await fetch(apiUrl, fetchOptions);
    clearTimeout(timeout);

    // Handle response
    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data,
      });
    }

    return res.status(response.status).json({
      ...data,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Request timeout",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
