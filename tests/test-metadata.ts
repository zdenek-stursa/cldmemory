import { MemoryService } from '../src/services/memory';
import { MemoryType } from '../src/types/memory';
import * as os from 'os';
import * as path from 'path';

async function testMetadataAndProject() {
  console.log('Starting metadata and project test...\n');
  
  const memoryService = new MemoryService();
  await memoryService.initialize();
  
  // Test 1: Create memory with metadata and project
  console.log('Test 1: Creating memory with automatic metadata and project...');
  const testMemory = await memoryService.createMemory(
    'This is a test memory to verify metadata and project fields are working correctly',
    MemoryType.SEMANTIC,
    { tags: ['test', 'metadata'] },
    0.8
  );
  
  console.log('Created memory:');
  console.log('- ID:', testMemory.id);
  console.log('- Project:', testMemory.project);
  console.log('- Metadata:', JSON.stringify(testMemory.metadata, null, 2));
  console.log('- Expected project format:', `${os.hostname()}:${process.cwd()}`);
  
  // Test 2: Search for the memory
  console.log('\nTest 2: Searching for the memory...');
  const searchResults = await memoryService.searchMemories({
    query: 'test memory metadata project',
    limit: 5,
    detailLevel: 'full'
  });
  
  console.log(`Found ${searchResults.length} memories`);
  const foundMemory = searchResults.find(m => m.id === testMemory.id);
  if (foundMemory && 'project' in foundMemory) {
    console.log('✓ Memory found with project field:', foundMemory.project);
  } else {
    console.log('✗ Memory not found or missing project field');
  }
  
  // Test 3: Search with compact mode
  console.log('\nTest 3: Testing compact mode...');
  const compactResults = await memoryService.searchMemories({
    query: 'test memory metadata',
    limit: 5,
    detailLevel: 'compact'
  });
  
  if (compactResults.length > 0) {
    const compactMemory = compactResults[0];
    console.log('Compact memory fields:');
    console.log('- Has summary:', 'summary' in compactMemory);
    console.log('- Has project:', 'project' in compactMemory);
    if ('project' in compactMemory) {
      console.log('- Project value:', compactMemory.project);
    }
  }
  
  // Clean up
  console.log('\nCleaning up test memory...');
  await memoryService.deleteMemory(testMemory.id);
  console.log('✓ Test memory deleted');
  
  console.log('\nAll tests completed!');
  console.log('\nNote: To test MEMORY_METADATA env variable, set it before running:');
  console.log('Example: MEMORY_METADATA="server:prod,user:testuser" npm run test:metadata');
  
  process.exit(0);
}

testMetadataAndProject().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});