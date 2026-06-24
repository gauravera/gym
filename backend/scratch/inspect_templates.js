import prisma from "../src/prisma.js";

async function main() {
  const templates = await prisma.whatsAppTemplate.findMany();
  console.log("Approved templates count:", templates.length);
  for (const t of templates) {
    console.log(`\nTemplate: ${t.templateName} (${t.status})`);
    console.log("Components:", JSON.stringify(t.components, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
