import { MemoryService } from '../src/services/memory';
import { MemoryType } from '../src/types/memory';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

async function testConcurrentUpdates() {
  console.log(`${colors.blue}🧪 Concurrent Memory Updates Test${colors.reset}\n`);
  
  const service = new MemoryService();
  
  try {
    await service.initialize();
    console.log(`${colors.green}✓ Memory service initialized${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Failed to initialize:${colors.reset}`, error);
    process.exit(1);
  }

  // Create multiple test memories
  console.log(`\n${colors.yellow}Creating test memories...${colors.reset}`);
  const memoryIds: string[] = [];
  
  for (let i = 0; i < 5; i++) {
    const memory = await service.createMemory(
      `Test memory ${i} for concurrent update testing`,
      MemoryType.SEMANTIC,
      { tags: ['concurrent-test', `memory-${i}`] },
      0.5,
      `Concurrent test memory ${i}`
    );
    memoryIds.push(memory.id);
    console.log(`  Created memory ${i}: ${memory.id}`);
  }

  // Test 1: Concurrent updates to different memories
  console.log(`\n${colors.yellow}Test 1: Concurrent updates to different memories${colors.reset}`);
  try {
    const updatePromises = memoryIds.map((id, index) => 
      service.updateMemory(id, {
        content: `Updated content for memory ${index}`,
        importance: 0.6 + (index * 0.05)
      })
    );
    
    const results = await Promise.all(updatePromises);
    const allSuccessful = results.every(r => r !== null);
    
    if (allSuccessful) {
      console.log(`${colors.green}✓ All ${results.length} concurrent updates successful${colors.reset}`);
    } else {
      throw new Error('Some updates failed');
    }
  } catch (error) {
    console.error(`${colors.red}✗ Concurrent updates failed:${colors.reset}`, error);
  }

  // Test 2: Concurrent updates to same memory
  console.log(`\n${colors.yellow}Test 2: Concurrent updates to same memory${colors.reset}`);
  const targetId = memoryIds[0];
  try {
    const updates = [
      { importance: 0.9 },
      { metadata: { update1: true } },
      { context: { tags: ['concurrent', 'update1'] } },
      { metadata: { update2: true } },
      { context: { mood: 'concurrent-testing' } }
    ];
    
    const updatePromises = updates.map(update => 
      service.updateMemory(targetId, update)
    );
    
    const results = await Promise.all(updatePromises);
    const lastResult = results[results.length - 1];
    
    if (lastResult) {
      console.log(`${colors.green}✓ Concurrent updates to same memory completed${colors.reset}`);
      console.log(`  Final importance: ${lastResult.importance}`);
      console.log(`  Final metadata keys: ${Object.keys(lastResult.metadata).join(', ')}`);
      console.log(`  Final mood: ${lastResult.context.mood}`);
    }
  } catch (error) {
    console.error(`${colors.red}✗ Same memory updates failed:${colors.reset}`, error);
  }

  // Test 3: Mixed operations (update + search)
  console.log(`\n${colors.yellow}Test 3: Concurrent updates and searches${colors.reset}`);
  try {
    const operations = [
      service.updateMemory(memoryIds[1], { importance: 0.95 }),
      service.searchMemories({ query: 'concurrent', limit: 10, detailLevel: 'compact' }),
      service.updateMemory(memoryIds[2], { content: 'Updated during search' }),
      service.searchMemories({ query: 'Updated', limit: 10, detailLevel: 'compact' }),
      service.updateMemory(memoryIds[3], { metadata: { searchTest: true } })
    ];
    
    const results = await Promise.all(operations);
    console.log(`${colors.green}✓ Mixed concurrent operations completed${colors.reset}`);
    console.log(`  Updates: ${results.filter(r => r && 'id' in r).length}`);
    console.log(`  Searches: ${results.filter(r => Array.isArray(r)).length}`);
  } catch (error) {
    console.error(`${colors.red}✗ Mixed operations failed:${colors.reset}`, error);
  }

  // Test 4: Rapid sequential updates
  console.log(`\n${colors.yellow}Test 4: Rapid sequential updates${colors.reset}`);
  const rapidTarget = memoryIds[4];
  try {
    let finalMemory;
    for (let i = 0; i < 10; i++) {
      finalMemory = await service.updateMemory(rapidTarget, {
        metadata: { 
          ...finalMemory?.metadata,
          [`update_${i}`]: new Date().toISOString(),
          updateCount: i + 1
        }
      });
    }
    
    if (finalMemory && finalMemory.metadata.updateCount === 10) {
      console.log(`${colors.green}✓ Completed 10 rapid updates${colors.reset}`);
      console.log(`  Final update count: ${finalMemory.metadata.updateCount}`);
    }
  } catch (error) {
    console.error(`${colors.red}✗ Rapid updates failed:${colors.reset}`, error);
  }

  // Cleanup
  console.log(`\n${colors.yellow}Cleaning up test memories...${colors.reset}`);
  try {
    await Promise.all(memoryIds.map(id => service.deleteMemory(id)));
    console.log(`${colors.green}✓ Deleted all test memories${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Cleanup failed:${colors.reset}`, error);
  }

  console.log(`\n${colors.green}🎉 Concurrent update tests completed${colors.reset}`);
  process.exit(0);
}

// Run with timeout
const timeout = setTimeout(() => {
  console.error(`${colors.red}✗ Test timed out${colors.reset}`);
  process.exit(1);
}, 30000);

testConcurrentUpdates()
  .catch(error => {
    console.error(`${colors.red}✗ Test failed:${colors.reset}`, error);
    process.exit(1);
  })
  .finally(() => clearTimeout(timeout));