
import { IncomingForm } from 'formidable';
import fs from 'fs';
import { getToken } from "next-auth/jwt";
import { baseURL } from "@/lib/config";


export const config = {
  api: {
    bodyParser: false, // Disable default body parsing
  },
};

export default async function handler(req, res) {
  const { method, query } = req;
  const apiPath = Array.isArray(query.slug) ? query.slug.join("/") : "";

  const allowedMethods = ["POST", "PUT", "PATCH"];

  
  if (!allowedMethods.includes(method)) {
    return res.status(405).json({
      success: false,
      message: `Method ${method} not allowed for FormData requests`,
    });
  }

  try {
    // Verify authentication
  const session = await getToken({req, secret: process.env.NEXTAUTH_SECRET});
    if (!session?.access_token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No access token",
      });
    }

    // Parse FormData using formidable
    const formData = await parseFormData(req);

    // Construct request to backend API
    const apiUrl =`${baseURL}/api/${apiPath}/`;


    // Create new FormData for the outgoing request
    const outgoingForm = new FormData();

    // Append all fields
    for (const [key, value] of Object.entries(formData.fields)) {
      // Handle array fields (if value is an array)
      if (Array.isArray(value)) {
        value.forEach(v => outgoingForm.append(key, v));
      } else {
        outgoingForm.append(key, value);
      }
    }

    // Append all files
    for (const [key, files] of Object.entries(formData.files)) {
      const fileArray = Array.isArray(files) ? files : [files];
      for (const file of fileArray) {
        // Read the file content and create a Blob
        const fileContent = fs.readFileSync(file.filepath);
        const blob = new Blob([fileContent], { type: file.mimetype || 'application/octet-stream' });
        
        // Append the Blob with the original filename
        outgoingForm.append(key, blob, file.originalFilename || file.newFilename);
      }
    }

    // Prepare headers
    const headers = {
      Authorization: `Bearer ${session.access_token}`,
      // Don't set Content-Type - let the browser set it with the boundary
    };

    // Prepare request options
    const requestOptions = {
      method: method,
      headers: headers,
      body: outgoingForm,
    };

    const apiResponse = await fetch(apiUrl, requestOptions);
    const responseContentType = apiResponse.headers.get("content-type");

    if (!apiResponse.ok) {
      const errorData = responseContentType?.includes("application/json")
        ? await apiResponse.json()
        : await apiResponse.text();

      return res.status(apiResponse.status).json({
        success: false,
        message: errorData.message || "API request failed",
        error: errorData,
      });
    }

    const responseData = responseContentType?.includes("application/json")
      ? await apiResponse.json()
      : await apiResponse.text();
      
    return res.status(apiResponse.status).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
   
    return res.status(500).json({
      success: false,
      message: "Internal proxy server error",
      error: error.message,
    });
  }
}

// Helper function to parse FormData using formidable
async function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}