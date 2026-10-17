import { NextResponse, type NextRequest } from "next/server";
import { currentOwner } from "@/lib/owner";
import { readPage } from "@/lib/page";
import { draftWatch, AiError } from "@/lib/ai";
import { fail, storePath } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Step 1 of a new watch: read the page once, lock onto the item, and turn the owner's words into a checklist.
export async function POST(req: NextRequest) {
  const owner = await currentOwner();
  if (!owner) return fail("Open the demo first.", 401);
  const { url, wants } = await req.json();
  const path = storePath(String(url ?? ""));
  if (!path) return fail("In this demo, Standby can watch pages on Tixora and Wren. Paste a link from one of those.");
  if (!String(wants ?? "").trim()) return fail("Tell Standby what you want, in your own words.");

  try {
    const page = await readPage(path);
    const listing = await prisma.listing.findUnique({ where: { id: page.listingId } });
    if (!listing || listing.ownerId !== owner.id) return fail("That link is from someone else's demo. Use the links on this page.");
    const draft = await draftWatch({ wants: String(wants), pageText: page.text, today: new Date().toISOString().slice(0, 10) });
    return NextResponse.json({
      draft,
      item: {
        url: path,
        listingId: page.listingId,
        name: page.name,
        kind: page.kind,
        store: listing.store === "tixora" ? "Tixora" : "Wren",
        storeSeller: listing.store === "wren" ? "Wren" : null,
      },
    });
  } catch (e) {
    return fail(e instanceof AiError || e instanceof Error ? e.message : "Couldn't read that page.");
  }
}
