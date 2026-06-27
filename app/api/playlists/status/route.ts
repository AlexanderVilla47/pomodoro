export async function GET() {
  return Response.json({ configured: !!process.env.YOUTUBE_API_KEY });
}
