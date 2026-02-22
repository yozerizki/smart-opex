import { PrismaClient } from '@prisma/client'

async function main(){
  const prisma = new PrismaClient()
  try{
    const items = await prisma.opex_items.findMany({ include: { documents: { include: { ocr_results: true } } } })
    console.log(`Found ${items.length} activities`)
    for(const it of items){
      const total = it.documents.reduce((acc, d) => acc + (d.ocr_results && d.ocr_results.length ? Number(d.ocr_results[0].parsed_amount || 0) : 0), 0)
      const manual = Number(it.amount || 0)
      const equal = Math.abs(total - manual) < 0.01
      const newStatus = equal ? 'OK' : 'PERLU_REVIEW'
      if(it.status !== newStatus){
        await prisma.opex_items.update({ where: { id: it.id }, data: { status: newStatus } })
        console.log(`Updated id=${it.id} status ${it.status} -> ${newStatus} (manual=${manual} ocr=${total})`)
      }
    }
  }finally{
    await prisma.$disconnect()
  }
}

main().catch(e=>{ console.error(e); process.exit(1) })
