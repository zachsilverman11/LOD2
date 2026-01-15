import { PrismaClient } from '../app/generated/prisma'

async function testDatabaseConnection() {
  console.log('🔍 Testing Neon Database Connection...\n')

  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  })

  try {
    // Test 1: Basic connection
    console.log('Test 1: Testing basic database connection...')
    await prisma.$connect()
    console.log('✅ Successfully connected to database\n')

    // Test 2: Query execution
    console.log('Test 2: Testing query execution...')
    const leadCount = await prisma.lead.count()
    console.log(`✅ Query successful - Found ${leadCount} leads in database\n`)

    // Test 3: Get database version
    console.log('Test 3: Checking PostgreSQL version...')
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`
    console.log(`✅ PostgreSQL Version: ${result[0].version}\n`)

    // Test 4: Check recent activity
    console.log('Test 4: Checking recent database activity...')
    const recentLeads = await prisma.lead.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      }
    })
    console.log(`✅ Found ${recentLeads.length} recent leads`)
    if (recentLeads.length > 0) {
      const name = `${recentLeads[0].firstName || ''} ${recentLeads[0].lastName || ''}`.trim() || 'No name'
      console.log(`   Most recent: ${name} (${recentLeads[0].createdAt.toISOString()})\n`)
    }

    // Test 5: Check Communications
    console.log('Test 5: Checking communications...')
    const commCount = await prisma.communication.count()
    console.log(`✅ Found ${commCount} communications in database\n`)

    // Test 6: Check call outcomes
    console.log('Test 6: Checking call outcomes...')
    const callCount = await prisma.callOutcome.count()
    console.log(`✅ Found ${callCount} call outcomes in database\n`)

    console.log('✅ ALL TESTS PASSED - Database is fully operational!')
    console.log('\nDatabase Summary:')
    console.log(`  - Total Leads: ${leadCount}`)
    console.log(`  - Total Communications: ${commCount}`)
    console.log(`  - Total Call Outcomes: ${callCount}`)

  } catch (error) {
    console.error('❌ Database connection failed!')
    console.error('Error details:', error)

    if (error instanceof Error) {
      if (error.message.includes('connect')) {
        console.error('\n⚠️  Connection Error: Cannot reach the database server')
        console.error('   Possible causes:')
        console.error('   - Database is suspended or inactive')
        console.error('   - Network connectivity issues')
        console.error('   - Invalid connection credentials')
      } else if (error.message.includes('timeout')) {
        console.error('\n⚠️  Timeout Error: Database took too long to respond')
        console.error('   This might indicate the database is starting up after suspension')
      }
    }

    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testDatabaseConnection()
