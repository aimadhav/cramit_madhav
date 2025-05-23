// content for cramitfinal/app/hello+api.ts
console.log("[API /hello+api.ts CRAMITFINAL] File loaded and parsed by Node.js");

export async function GET() {
  console.log("[API /hello+api.ts CRAMITFINAL] GET function invoked");
  return new Response(JSON.stringify({ message: "API response from CRAMITFINAL" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
