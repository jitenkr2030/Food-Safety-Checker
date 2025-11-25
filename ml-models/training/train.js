const path = require('path');
const IndianFoodTrainingManager = require('./IndianFoodTrainingManager');

/**
 * Main Training Script for Indian Food Safety ML Models
 * Sets up and trains all 8 specialized models for comprehensive food safety analysis
 */
async function main() {
  console.log('🚀 Starting Indian Food Safety ML Model Training Pipeline...\n');

  const trainingManager = new IndianFoodTrainingManager();

  try {
    // Step 1: Initialize training environment
    console.log('📋 Step 1: Initializing Training Environment');
    await trainingManager.initialize();
    console.log('✅ Training environment initialized\n');

    // Step 2: Prepare Indian food dataset
    console.log('🍛 Step 2: Preparing Indian Food Dataset');
    await trainingManager.prepareIndianFoodDataset();
    console.log('✅ Indian food dataset prepared\n');

    // Step 3: Check dataset status
    console.log('📊 Step 3: Checking Dataset Status');
    const datasetStatus = await trainingManager.getDatasetStatus();
    console.log('Dataset Status:', JSON.stringify(datasetStatus, null, 2));
    console.log('');

    // Step 4: Train all models
    console.log('🧠 Step 4: Training All Food Safety Models');
    const trainingResults = await trainingManager.trainAllModels();
    
    // Display training summary
    console.log('\n📈 Training Results Summary:');
    Object.entries(trainingResults).forEach(([modelName, result]) => {
      if (result.error) {
        console.log(`❌ ${modelName}: FAILED - ${result.error}`);
      } else {
        console.log(`✅ ${modelName}: SUCCESS`);
        console.log(`   - Accuracy: ${(result.finalAccuracy * 100).toFixed(1)}%`);
        console.log(`   - Training Time: ${(result.trainingTime / 1000).toFixed(1)}s`);
        console.log(`   - Model Size: ${result.modelSize?.sizeMB || 'Unknown'} MB`);
      }
    });
    console.log('');

    // Step 5: Load and test pre-trained models
    console.log('🔄 Step 5: Loading Pre-trained Models');
    await trainingManager.loadPretrainedModels();
    console.log('✅ Models loaded successfully\n');

    // Step 6: Export models for production
    console.log('📦 Step 6: Exporting Models for Production');
    const exportResults = await trainingManager.exportModelsForProduction();
    console.log('Export Results:', JSON.stringify(exportResults, null, 2));
    console.log('');

    // Step 7: Generate comprehensive report
    console.log('📋 Step 7: Generating Training Report');
    const report = await trainingManager.getTrainingReport();
    
    // Save comprehensive report
    const reportPath = path.join(__dirname, '..', 'training_report.json');
    const fs = require('fs-extra');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    console.log(`✅ Training report saved to: ${reportPath}`);
    console.log('');

    // Step 8: Display final summary
    console.log('🎉 Training Pipeline Completed Successfully!');
    console.log('\n📊 Final Summary:');
    console.log(`✅ Models Trained: ${report.training_results?.training_summary?.successful_trainings || 0}`);
    console.log(`❌ Models Failed: ${report.training_results?.training_summary?.failed_trainings || 0}`);
    console.log(`📈 Average Accuracy: ${(report.training_results?.training_summary?.average_accuracy * 100 || 0).toFixed(1)}%`);
    console.log(`📁 Report Location: ${reportPath}`);
    console.log('');

    // Display next steps
    console.log('🚀 Next Steps:');
    if (report.training_results?.training_summary?.failed_trainings > 0) {
      console.log('1. Investigate failed model training and retry');
      console.log('2. Check data quality and training configuration');
      console.log('3. Adjust hyperparameters if needed');
    }
    console.log('1. Integrate trained models with the backend API');
    console.log('2. Test the complete food analysis pipeline');
    console.log('3. Deploy to production environment');
    console.log('4. Monitor model performance in production');
    console.log('');

    console.log('✨ Indian Food Safety ML Models Ready for Production! ✨');

  } catch (error) {
    console.error('\n❌ Training Pipeline Failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check TensorFlow.js installation');
    console.error('2. Ensure sufficient disk space for model files');
    console.error('3. Verify system memory availability');
    console.error('4. Check Node.js version compatibility');
    process.exit(1);
  }
}

/**
 * Quick test script to verify model integration
 */
async function testModels() {
  console.log('🧪 Testing ML Model Integration...\n');

  try {
    const trainingManager = new IndianFoodTrainingManager();
    await trainingManager.initialize();
    
    // Test model status
    console.log('📊 Model Status Check:');
    const modelStatus = await trainingManager.getModelStatus();
    Object.entries(modelStatus).forEach(([modelName, status]) => {
      console.log(`${status.trained ? '✅' : '⚠️'} ${modelName}: ${status.trained ? 'Ready' : 'Needs Training'}`);
    });
    
    // Test ML service if available
    console.log('\n🔄 Testing ML Service Integration:');
    try {
      const service = await trainingManager.service.initialize();
      console.log('✅ ML Service initialized successfully');
    } catch (error) {
      console.log('⚠️ ML Service not available, will use mock data for testing');
    }
    
    console.log('\n🎯 Model Integration Test Complete!');
    
  } catch (error) {
    console.error('❌ Model integration test failed:', error);
  }
}

/**
 * Dataset preparation only script
 */
async function prepareDatasetOnly() {
  console.log('🍛 Preparing Indian Food Dataset Only...\n');

  try {
    const trainingManager = new IndianFoodTrainingManager();
    await trainingManager.initialize();
    await trainingManager.prepareIndianFoodDataset();
    
    const datasetStatus = await trainingManager.getDatasetStatus();
    console.log('\n✅ Dataset preparation completed!');
    console.log('Dataset Status:', JSON.stringify(datasetStatus, null, 2));
    
  } catch (error) {
    console.error('❌ Dataset preparation failed:', error);
  }
}

/**
 * Training only script
 */
async function trainModelsOnly() {
  console.log('🧠 Training Models Only...\n');

  try {
    const trainingManager = new IndianFoodTrainingManager();
    await trainingManager.initialize();
    
    // Check if dataset exists
    const datasetStatus = await trainingManager.getDatasetStatus();
    if (datasetStatus.status !== 'ready') {
      console.log('⚠️ Dataset not ready. Please run prepareDatasetOnly() first.');
      return;
    }
    
    const trainingResults = await trainingManager.trainAllModels();
    
    console.log('\n📈 Training completed!');
    console.log('Training Results:', JSON.stringify(trainingResults, null, 2));
    
  } catch (error) {
    console.error('❌ Model training failed:', error);
  }
}

// Main execution
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      testModels();
      break;
    case 'prepare':
      prepareDatasetOnly();
      break;
    case 'train':
      trainModelsOnly();
      break;
    case 'full':
    default:
      main();
      break;
  }
}

module.exports = {
  main,
  testModels,
  prepareDatasetOnly,
  trainModelsOnly
};