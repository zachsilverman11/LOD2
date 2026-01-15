/**
 * Script to find Pipedrive pipeline and stage IDs
 * Run: npx tsx scripts/find-pipedrive-ids.ts
 */

const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN || '2b211909afd7f9f3614f582af4a97a3e921a3efb';
const PIPEDRIVE_COMPANY = process.env.PIPEDRIVE_COMPANY_DOMAIN || 'inspiredmortgage';

async function findPipelineIds() {
  console.log('🔍 Fetching all pipelines from Pipedrive...\n');

  try {
    // Fetch all pipelines
    const pipelinesResponse = await fetch(
      `https://${PIPEDRIVE_COMPANY}.pipedrive.com/v1/pipelines?api_token=${PIPEDRIVE_API_TOKEN}`
    );
    const pipelinesData = await pipelinesResponse.json();

    if (!pipelinesData.success) {
      console.error('❌ Failed to fetch pipelines:', pipelinesData);
      return;
    }

    console.log('📊 Available Pipelines:\n');

    for (const pipeline of pipelinesData.data) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Pipeline: ${pipeline.name}`);
      console.log(`Pipeline ID: ${pipeline.id}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Fetch stages for this pipeline
      const stagesResponse = await fetch(
        `https://${PIPEDRIVE_COMPANY}.pipedrive.com/v1/stages?pipeline_id=${pipeline.id}&api_token=${PIPEDRIVE_API_TOKEN}`
      );
      const stagesData = await stagesResponse.json();

      if (stagesData.success && stagesData.data) {
        console.log(`\nStages in "${pipeline.name}":`);
        stagesData.data.forEach((stage: any, index: number) => {
          console.log(`  ${index + 1}. ${stage.name} (Stage ID: ${stage.id})`);
        });
      }
    }

    console.log('\n\n🎯 Looking for "Leads on Demand (Engaged)" pipeline...\n');

    const targetPipeline = pipelinesData.data.find((p: any) =>
      p.name.toLowerCase().includes('leads on demand') && p.name.toLowerCase().includes('engaged')
    );

    if (targetPipeline) {
      console.log('✅ Found target pipeline!');
      console.log(`   Pipeline: ${targetPipeline.name}`);
      console.log(`   Pipeline ID: ${targetPipeline.id}`);

      // Fetch stages for target pipeline
      const stagesResponse = await fetch(
        `https://${PIPEDRIVE_COMPANY}.pipedrive.com/v1/stages?pipeline_id=${targetPipeline.id}&api_token=${PIPEDRIVE_API_TOKEN}`
      );
      const stagesData = await stagesResponse.json();

      if (stagesData.success && stagesData.data) {
        const appStartedStage = stagesData.data.find((s: any) =>
          s.name.toLowerCase().includes('app started')
        );

        if (appStartedStage) {
          console.log(`   Stage: ${appStartedStage.name}`);
          console.log(`   Stage ID: ${appStartedStage.id}`);
          console.log('\n✅ Use these IDs in your code:');
          console.log(`   pipeline_id: ${targetPipeline.id},`);
          console.log(`   stage_id: ${appStartedStage.id}, // ${appStartedStage.name}`);
        } else {
          console.log('\n⚠️  Could not find "App Started" stage. Available stages:');
          stagesData.data.forEach((stage: any) => {
            console.log(`   - ${stage.name} (ID: ${stage.id})`);
          });
        }
      }
    } else {
      console.log('⚠️  Pipeline "Leads on Demand (Engaged)" not found.');
      console.log('   Please check the pipeline name in Pipedrive and try again.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findPipelineIds();
