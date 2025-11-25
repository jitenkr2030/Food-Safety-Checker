const tf = require('@tensorflow/tfjs-node');
const FoodSafetyBaseModel = require('./FoodSafetyBaseModel');

/**
 * Salt/Sugar Level Detection Model for Indian Foods
 * Estimates salt and sugar content based on visual analysis
 */
class SaltSugarModel extends FoodSafetyBaseModel {
  constructor() {
    super({
      modelType: 'salt_sugar',
      inputShape: [224, 224, 3],
      numClasses: 1, // Regression output for salt and sugar levels
      regressionOutput: ['salt_level_mg', 'sugar_level_mg', 'combined_sodium_eq']
    });
  }

  extractSaltSugarFeatures(imageTensor) {
    return tf.tidy(() => {
      const colorFeatures = this.analyzeCrystallineStructures(imageTensor);
      const textureFeatures = this.analyzeSurfaceTexture(imageTensor);
      const brightnessFeatures = this.analyzeBrightnessPatterns(imageTensor);
      
      return tf.concat([colorFeatures, textureFeatures, brightnessFeatures], 0);
    });
  }

  analyzeCrystallineStructures(imageTensor) {
    return tf.tidy(() => {
      // Convert to LAB for better crystal detection
      const lab = this.rgbToLab(imageTensor);
      const lChannel = lab.slice([0, 0, 0], [224, 224, 1]);
      
      // Detect bright crystalline areas (salt crystals, sugar)
      const crystalMask = lChannel.greater(0.7);
      const crystalRatio = crystalMask.mean();
      
      // Calculate crystal density
      const edgeMagnitude = this.detectCrystalEdges(lChannel);
      const crystalDensity = edgeMagnitude.greater(0.2).mean();
      
      // Clean up
      lab.dispose();
      lChannel.dispose();
      crystalMask.dispose();
      edgeMagnitude.dispose();
      
      return tf.tensor([crystalRatio.dataSync()[0], crystalDensity.dataSync()[0]]);
    });
  }

  detectCrystalEdges(imageTensor) {
    return tf.tidy(() => {
      const sobelX = tf.image.sobelEdges(imageTensor).slice([0, 0, 0], [224, 224, 1, 1]);
      const sobelY = tf.image.sobelEdges(imageTensor).slice([0, 0, 1], [224, 224, 1, 1]);
      return tf.sqrt(sobelX.square().add(sobelY.square()));
    });
  }

  analyzeSurfaceTexture(imageTensor) {
    return tf.tidy(() => {
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Surface roughness (indicator of crystallization)
      const localVar = this.calculateLocalVariance(grayImage);
      const textureVariance = localVar.mean();
      
      // Smoothness vs roughness balance
      const smoothMask = grayImage.less(0.1);
      const roughMask = grayImage.greater(0.6);
      const smoothRatio = smoothMask.mean();
      const roughRatio = roughMask.mean();
      
      // Clean up
      grayImage.dispose();
      localVar.dispose();
      smoothMask.dispose();
      roughMask.dispose();
      
      return tf.tensor([textureVariance.dataSync()[0], smoothRatio.dataSync()[0], 
                       roughRatio.dataSync()[0]]);
    });
  }

  analyzeBrightnessPatterns(imageTensor) {
    return tf.tidy(() => {
      const brightness = imageTensor.mean(-1);
      
      // Brightness distribution
      const brightnessMean = brightness.mean();
      const brightnessVariance = brightness.sub(brightnessMean).square().mean();
      
      // High brightness spots (potential salt/sugar deposits)
      const brightSpots = brightness.greater(0.8);
      const brightSpotRatio = brightSpots.mean();
      
      // Clean up
      brightness.dispose();
      brightSpots.dispose();
      
      return tf.tensor([brightnessMean.dataSync()[0], brightnessVariance.dataSync()[0],
                       brightSpotRatio.dataSync()[0]]);
    });
  }

  rgbToLab(rgbImage) {
    return tf.tidy(() => {
      const normalized = rgbImage.div(255.0);
      const r = normalized.slice([0, 0, 0], [224, 224, 1]);
      const g = normalized.slice([0, 0, 1], [224, 224, 1]);
      const b = normalized.slice([0, 0, 2], [224, 224, 1]);
      
      // Simplified LAB conversion
      const l = r.mul(0.3).add(g.mul(0.59)).add(b.mul(0.11)).mul(100);
      const a = r.sub(g).mul(128);
      const bCh = g.sub(b).mul(128);
      
      return tf.concat([l.expandDims(-1), a.expandDims(-1), bCh.expandDims(-1)], -1);
    });
  }

  calculateLocalVariance(imageTensor) {
    return tf.tidy(() => {
      const kernel = tf.ones([3, 3, 1, 1]).div(9);
      const mean = tf.conv2d(imageTensor.reshape([224, 224, 1]), kernel, 1, 'same');
      const squared = imageTensor.reshape([224, 224, 1]).square();
      const meanSquared = tf.conv2d(squared, kernel, 1, 'same');
      
      const variance = meanSquared.sub(mean.square());
      kernel.dispose();
      mean.dispose();
      squared.dispose();
      meanSquared.dispose();
      
      return variance;
    });
  }

  async predict(imagePath) {
    try {
      const preprocessedImage = await this.preprocessImage(imagePath);
      const features = this.extractSaltSugarFeatures(preprocessedImage);
      const estimates = this.calculateSaltSugarEstimates(features);
      
      const detailedAnalysis = this.generateSaltSugarAnalysis(estimates);
      
      preprocessedImage.dispose();
      features.dispose();
      
      return {
        ...detailedAnalysis,
        saltSugarProfile: estimates,
        healthScore: estimates.healthScore
      };
    } catch (error) {
      throw new Error(`Salt/Sugar prediction failed: ${error.message}`);
    }
  }

  calculateSaltSugarEstimates(features) {
    return tf.tidy(() => {
      const f = features.dataSync();
      
      // Salt estimation based on crystalline features
      const crystalRatio = f[0];
      const crystalDensity = f[1];
      const textureVariance = f[3];
      const brightSpotRatio = f[6];
      
      let saltLevel = 0;
      let sugarLevel = 0;
      
      // Salt estimation (Indian food context)
      if (crystalRatio > 0.15 && brightSpotRatio > 0.1) {
        saltLevel = 800; // High salt
      } else if (crystalRatio > 0.08) {
        saltLevel = 500; // Moderate salt
      } else if (crystalRatio > 0.03) {
        saltLevel = 300; // Low salt
      } else {
        saltLevel = 50; // Very low salt
      }
      
      // Sugar estimation (for desserts, sweets)
      if (crystalRatio > 0.20 && brightSpotRatio > 0.15) {
        sugarLevel = 15000; // Very high sugar
      } else if (crystalRatio > 0.12) {
        sugarLevel = 8000; // High sugar
      } else if (crystalRatio > 0.05) {
        sugarLevel = 3000; // Moderate sugar
      } else {
        sugarLevel = 500; // Low sugar
      }
      
      // Combined sodium equivalent (mg per serving)
      const sodiumEquivalent = saltLevel + (sugarLevel * 0.001); // Simplified conversion
      
      // Health score calculation
      let healthScore = 80; // Base score
      
      if (saltLevel > 600) healthScore -= 30;
      else if (saltLevel > 300) healthScore -= 15;
      
      if (sugarLevel > 10000) healthScore -= 25;
      else if (sugarLevel > 5000) healthScore -= 10;
      
      healthScore = Math.max(healthScore, 0);
      
      return {
        saltLevel: Math.round(saltLevel),
        sugarLevel: Math.round(sugarLevel),
        sodiumEquivalent: Math.round(sodiumEquivalent),
        healthScore: Math.round(healthScore),
        riskLevel: saltLevel > 600 ? 'high' : saltLevel > 300 ? 'moderate' : 'low'
      };
    });
  }

  generateSaltSugarAnalysis(estimates) {
    const analysis = {
      primaryFindings: [],
      healthRisks: [],
      recommendations: []
    };

    // Salt analysis
    if (estimates.saltLevel > 600) {
      analysis.primaryFindings.push('High salt content detected');
      analysis.healthRisks.push('May contribute to hypertension');
      analysis.recommendations.push('Rinse food to reduce salt content');
    } else if (estimates.saltLevel > 300) {
      analysis.primaryFindings.push('Moderate salt content');
      analysis.healthRisks.push('Regular consumption may affect blood pressure');
      analysis.recommendations.push('Balance with low-sodium foods');
    } else {
      analysis.primaryFindings.push('Low salt content');
      analysis.recommendations.push('Good for sodium-conscious diet');
    }

    // Sugar analysis
    if (estimates.sugarLevel > 10000) {
      analysis.primaryFindings.push('Very high sugar content');
      analysis.healthRisks.push('May cause blood sugar spikes');
      analysis.recommendations.push('Consume in moderation');
    } else if (estimates.sugarLevel > 5000) {
      analysis.primaryFindings.push('High sugar content');
      analysis.healthRisks.push('Regular consumption may affect diabetes risk');
      analysis.recommendations.push('Balance with protein/fiber');
    }

    return analysis;
  }

  buildModel() {
    return tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: this.inputShape,
          filters: 32,
          kernelSize: 5,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.globalAveragePooling2d(),
        
        tf.layers.dense({
          units: 256,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({
          units: this.modelConfig.regressionOutput.length,
          activation: 'linear'
        })
      ]
    });
  }

  compileModel() {
    const optimizer = tf.train.adam(0.0005);
    
    this.model.compile({
      optimizer: optimizer,
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    console.log(`✅ ${this.modelType} model compiled for regression`);
  }
}

module.exports = SaltSugarModel;