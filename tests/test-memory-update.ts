import { MemoryService } from '../src/services/memory';
import { MemoryType } from '../src/types/memory';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testMemoryUpdate() {
  console.log(`${colors.blue}🧪 Memory Update Test Suite${colors.reset}\n`);
  
  const service = new MemoryService();
  let testsPassed = 0;
  let testsFailed = 0;
  
  try {
    await service.initialize();
    console.log(`${colors.green}✓ Memory service initialized${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Failed to initialize memory service:${colors.reset}`, error);
    process.exit(1);
  }

  // Test 1: Create a memory to update
  console.log(`\n${colors.yellow}Test 1: Create initial memory${colors.reset}`);
  let testMemory: any;
  try {
    testMemory = await service.createMemory(
      'This is the original content that will be updated',
      MemoryType.SEMANTIC,
      { tags: ['test', 'update-test', 'original'] },
      0.5,
      'Original test memory'
    );
    console.log(`${colors.green}✓ Created memory with ID: ${testMemory.id}${colors.reset}`);
    console.log(`  Summary: ${testMemory.summary}`);
    console.log(`  Content: ${testMemory.content.substring(0, 50)}...`);
    testsPassed++;
  } catch (error) {
    console.error(`${colors.red}✗ Failed to create memory:${colors.reset}`, error);
    testsFailed++;
    process.exit(1);
  }

  // Wait a bit to ensure memory is indexed
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Update memory content
  console.log(`\n${colors.yellow}Test 2: Update memory content${colors.reset}`);
  try {
    const updatedMemory = await service.updateMemory(testMemory.id, {
      content: 'This is the UPDATED content with new information',
      importance: 0.8
    });
    
    if (updatedMemory) {
      console.log(`${colors.green}✓ Successfully updated memory content${colors.reset}`);
      console.log(`  New content: ${updatedMemory.content}`);
      console.log(`  New importance: ${updatedMemory.importance}`);
      console.log(`  Summary unchanged: ${updatedMemory.summary === testMemory.summary}`);
      testsPassed++;
    } else {
      throw new Error('Update returned null');
    }
  } catch (error) {
    console.error(`${colors.red}✗ Failed to update memory:${colors.reset}`, error);
    testsFailed++;
  }

  // Test 3: Update memory context
  console.log(`\n${colors.yellow}Test 3: Update memory context${colors.reset}`);
  try {
    const updatedMemory = await service.updateMemory(testMemory.id, {
      context: { 
        tags: ['test', 'update-test', 'modified'],
        mood: 'testing',
        activity: 'running update tests'
      }
    });
    
    if (updatedMemory) {
      console.log(`${colors.green}✓ Successfully updated memory context${colors.reset}`);
      console.log(`  New tags: ${updatedMemory.context.tags?.join(', ')}`);
      console.log(`  New mood: ${updatedMemory.context.mood}`);
      console.log(`  New activity: ${updatedMemory.context.activity}`);
      testsPassed++;
    } else {
      throw new Error('Update returned null');
    }
  } catch (error) {
    console.error(`${colors.red}✗ Failed to update context:${colors.reset}`, error);
    testsFailed++;
  }

  // Test 4: Update non-existent memory
  console.log(`\n${colors.yellow}Test 4: Update non-existent memory (should fail gracefully)${colors.reset}`);
  try {
    const result = await service.updateMemory('non-existent-id-12345', {
      content: 'This should not work'
    });
    
    if (result === null) {
      console.log(`${colors.green}✓ Correctly returned null for non-existent memory${colors.reset}`);
      testsPassed++;
    } else {
      throw new Error('Should have returned null');
    }
  } catch (error) {
    console.error(`${colors.red}✗ Unexpected error:${colors.reset}`, error);
    testsFailed++;
  }

  // Test 5: Update with metadata
  console.log(`\n${colors.yellow}Test 5: Update memory metadata${colors.reset}`);
  try {
    const updatedMemory = await service.updateMemory(testMemory.id, {
      metadata: {
        testRun: new Date().toISOString(),
        version: '1.1',
        customField: 'test value'
      }
    });
    
    if (updatedMemory && updatedMemory.metadata) {
      console.log(`${colors.green}✓ Successfully updated metadata${colors.reset}`);
      console.log(`  Metadata keys: ${Object.keys(updatedMemory.metadata).join(', ')}`);
      testsPassed++;
    } else {
      throw new Error('Metadata update failed');
    }
  } catch (error) {
    console.error(`${colors.red}✗ Failed to update metadata:${colors.reset}`, error);
    testsFailed++;
  }

  // Test 6: Verify updates are searchable
  console.log(`\n${colors.yellow}Test 6: Verify updated memory is searchable${colors.reset}`);
  try {
    const searchResults = await service.searchMemories({
      query: 'UPDATED content new information',
      limit: 5,
      detailLevel: 'full'
    }) as any[];
    
    const found = searchResults.find(m => m.id === testMemory.id);
    if (found) {
      console.log(`${colors.green}✓ Updated memory found in search${colors.reset}`);
      console.log(`  Found at position: ${searchResults.indexOf(found) + 1}`);
      console.log(`  Content matches: ${found.content.includes('UPDATED')}`);
      testsPassed++;
    } else {
      throw new Error('Updated memory not found in search');
    }
  } catch (error) {
    console.error(`${colors.red}✗ Search failed:${colors.reset}`, error);
    testsFailed++;
  }

  // Test 7: Clean up - delete test memory
  console.log(`\n${colors.yellow}Test 7: Clean up test memory${colors.reset}`);
  try {
    await service.deleteMemory(testMemory.id);
    
    // Verify deletion
    const deleted = await service.getMemory(testMemory.id);
    if (!deleted) {
      console.log(`${colors.green}✓ Test memory successfully deleted${colors.reset}`);
      testsPassed++;
    } else {
      throw new Error('Memory still exists after deletion');
    }
  } catch (error) {
    console.error(`${colors.red}✗ Failed to delete memory:${colors.reset}`, error);
    testsFailed++;
  }

  // Summary
  console.log(`\n${colors.blue}═══════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log(`\n${colors.green}🎉 All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}❌ Some tests failed${colors.reset}`);
    process.exit(1);
  }
}

// Run tests with timeout
const timeout = setTimeout(() => {
  console.error(`${colors.red}✗ Test suite timed out after 30 seconds${colors.reset}`);
  process.exit(1);
}, 30000);

testMemoryUpdate()
  .catch(error => {
    console.error(`${colors.red}✗ Unhandled error:${colors.reset}`, error);
    process.exit(1);
  })
  .finally(() => {
    clearTimeout(timeout);
  });