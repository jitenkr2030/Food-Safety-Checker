const tf = require('@tensorflow/tfjs-node');
const FoodSafetyBaseModel = require('./FoodSafetyBaseModel');

/**
 * Microplastics Risk Assessment Model for Food Items
 * Identifies potential microplastic contamination indicators
 */
class MicroplasticsModel extends FoodSafetyBaseModel {
  constructor() {
    super({
      modelType: 'microplastics_risk',
      inputShape: [224, 224, 3],
      numClasses: 4, // Low Risk, Moderate Risk, High Risk, Critical Risk
      classes: [
        'low_risk',        // Fresh, natural foods
        'moderate_risk',   // Packaged processed foods
        'high_risk',       // Heavily processed foods
        'critical_risk'    // Suspected microplastic contamination
      ]
    });
  }

  extractMicroplasticFeatures(imageTensor) {
    return tf.tidy(() => {
      const colorFeatures = this.analyzeUnusualParticles(imageTensor);
      const textureFeatures = this.detectSyntheticPatterns(imageTensor);
      const packagingFeatures = this.assessPackagingContamination(imageTensor);
      
      return tf.concat([colorFeatures, textureFeatures, packagingFeatures], 0);
    });
  }

  analyzeUnusualParticles(imageTensor) {
    return tf.tidy(() => {
      // Look for unusual bright particles that might indicate microplastics
      const hsv = tf.image.rgbToHsv(imageTensor);
      
      // High brightness particles (potential microplastics)
      const brightness = hsv.slice([0, 0, 2], [224, 224, 1]);
      const saturation = hsv.slice([0, 0, 1], [224, 224, 1]);
      const hue = hsv.slice([0, 0, 0], [224, 224, 1]);
      
      // Microplastics often appear as bright, reflective particles
      const brightParticles = brightness.greater(0.8).logicalAnd(saturation.greater(0.3));
      const particleRatio = brightParticles.mean();
      
      // Detect unusual color reflections
      const reflectiveMask = brightness.greater(0.9);
      const reflectiveRatio = reflectiveMask.mean();
      
      // Clean up
      hsv.dispose();
      brightness.dispose();
      saturation.dispose();
      hue.dispose();
      brightParticles.dispose();
      reflectiveMask.dispose();
      
      return tf.tensor([particleRatio.dataSync()[0], reflectiveRatio.dataSync()[0]]);
    });
  }

  detectSyntheticPatterns(imageTensor) {
    return tf.tidy(() => {
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Microplastics can create unusual texture patterns
      const edgeMagnitude = this.calculateEdgeMagnitude(grayImage);
      
      // Regular, geometric patterns (synthetic origin)
      const regularPatterns = this.detectRegularPatterns(grayImage);
      
      // Clean up
      grayImage.dispose();
      
      return tf.concat([edgeMagnitude, regularPatterns], 0);
    });
  }

  calculateEdgeMagnitude(imageTensor) {
    return tf.tidy(() => {
      const sobelX = tf.image.sobelEdges(imageTensor).slice([0, 0, 0], [224, 224, 1, 1]);
      const sobelY = tf.image.sobelEdges(imageTensor).slice([0, 0, 1], [224, 224, 1, 1]);
      const edgeMagnitude = tf.sqrt(sobelX.square().add(sobelY.square()));
      
      const edgeDensity = edgeMagnitude.greater(0.15).mean();
      const edgeVariance = edgeMagnitude.sub(edgeMagnitude.mean()).square().mean();
      
      sobelX.dispose();
      sobelY.dispose();
      edgeMagnitude.dispose();
      
      return tf.tensor([edgeDensity.dataSync()[0], edgeVariance.dataSync()[0]]);
    });
  }

  detectRegularPatterns(imageTensor) {
    return tf.tidy(() => {
      // Look for geometric patterns that might indicate synthetic materials
      const localPatterns = this.analyzeLocalPatterns(imageTensor);
      
      return tf.tensor([localPatterns.dataSync()[0]]);
    });
  }

  analyzeLocalPatterns(imageTensor) {
    return tf.tidy(() => {
      // Detect repetitive patterns typical of synthetic materials
      const kernel = tf.ones([7, 7, 1, 1]).div(49);
      const pattern = tf.conv2d(imageTensor.reshape([224, 224, 1]), kernel, 1, 'same');
      
      const patternSimilarity = this.calculatePatternSimilarity(imageTensor, pattern);
      
      kernel.dispose();
      pattern.dispose();
      
      return patternSimilarity;
    });
  }

  calculatePatternSimilarity(imageTensor, pattern) {
    return tf.tidy(() => {
      // High similarity indicates repetitive (synthetic) patterns
      const similarity = imageTensor.reshape([224, 224, 1]).sub(pattern).abs().mean();
      return tf.tensor([1 - similarity.dataSync()[0]]); // Invert for similarity measure
    });
  }

  assessPackagingContamination(imageTensor) {
    return tf.tidy(() => {
      // Check for packaging residue or plastic contamination
      const hsv = tf.image.rgbToHsv(imageTensor);
      
      // Plastic-like colors and shine
      const plasticMask = this.detectPlasticLikeAppearance(hsv);
      const contaminationRatio = plasticMask.mean();
      
      // Packaging color residues
      const packagingResidue = this.detectPackagingResidue(imageTensor);
      
      // Clean up
      hsv.dispose();
      plasticMask.dispose();
      
      return tf.tensor([contaminationRatio.dataSync()[0], packagingResidue.dataSync()[0]]);
    });
  }

  detectPlasticLikeAppearance(hsvImage) {
    return tf.tidy(() => {
      const brightness = hsvImage.slice([0, 0, 2], [224, 224, 1]);
      const saturation = hsvImage.slice([0, 0, 1], [224, 224, 1]);
      
      // Plastic-like appearance: high brightness + medium saturation
      return brightness.greater(0.7).logicalAnd(saturation.greater(0.2).logicalAnd(saturation.less(0.6)));
    });
  }

  detectPackagingResidue(imageTensor) {
    return tf.tidy(() => {
      // Look for colored packaging residues
      const hsv = tf.image.rgbToHsv(imageTensor);
      
      // Unusual packaging colors (not natural food colors)
      const redChannel = imageTensor.slice([0, 0, 0], [224, 224, 1]);
      const greenChannel = imageTensor.slice([0, 0, 1], [224, 224, 1]);
      const blueChannel = imageTensor.slice([0, 0, 2], [224, 224, 1]);
      
      // Packaging often has high contrast color ratios
      const colorContrast = redChannel.sub(blueChannel).abs().mean();
      
      // Clean up
      hsv.dispose();
      redChannel.dispose();
      greenChannel.dispose();
      blueChannel.dispose();
      
      return tf.tensor([colorContrast.dataSync()[0]]);
    });
  }

  async predict(imagePath) {
    try {
      const preprocessedImage = await this.preprocessImage(imagePath);
      const features = this.extractMicroplasticFeatures(preprocessedImage);
      const riskAssessment = this.assessMicroplasticRisk(features);
      
      const detailedAnalysis = this.generateMicroplasticAnalysis(riskAssessment);
      
      preprocessedImage.dispose();
      features.dispose();
      
      return {
        ...detailedAnalysis,
        microplasticProfile: riskAssessment,
        riskLevel: riskAssessment.riskLevel
      };
    } catch (error) {
      throw new Error(`Microplastic risk prediction failed: ${error.message}`);
    }
  }

  assessMicroplasticRisk(features) {
    return tf.tidy(() => {
      const f = features.dataSync();
      
      const particleRatio = f[0];
      const reflectiveRatio = f[1];
      const edgeDensity = f[2];
      const edgeVariance = f[3];
      const patternSimilarity = f[4];
      const plasticRatio = f[5];
      const packagingResidue = f[6];
      
      // Risk assessment based on multiple factors
      let riskLevel = 'low_risk';
      let riskScore = 0;
      let confidence = 0;
      
      // High microplastic indicators
      if (particleRatio > 0.05 || reflectiveRatio > 0.03) {
        riskLevel = 'critical_risk';
        riskScore = 90;
        confidence = Math.min(particleRatio * 5 + reflectiveRatio * 10, 1);
      }
      // Plastic contamination
      else if (plasticRatio > 0.02 || packagingResidue > 0.3) {
        riskLevel = 'high_risk';
        riskScore = 75;
        confidence = Math.min((plasticRatio + packagingResidue) * 2, 1);
      }
      // Synthetic patterns
      else if (patternSimilarity > 0.8 && edgeDensity > 0.1) {
        riskLevel = 'moderate_risk';
        riskScore = 50;
        confidence = Math.min(patternSimilarity, 1);
      }
      // Some indicators present
      else if (edgeVariance > 0.01 || reflectiveRatio > 0.01) {
        riskLevel = 'moderate_risk';
        riskScore = 30;
        confidence = Math.min(edgeVariance * 20, 1);
      }
      
      return {
        riskLevel,
        riskScore: Math.round(riskScore),
        confidence: Math.round(confidence * 100) / 100,
        indicators: {
          particleContamination: particleRatio,
          reflectiveParticles: reflectiveRatio,
          syntheticPatterns: patternSimilarity,
          plasticContamination: plasticRatio,
          packagingResidue: packagingResidue
        }
      };
    });
  }

  generateMicroplasticAnalysis(riskAssessment) {
    const analysis = {
      microplasticRisk: riskAssessment.riskLevel,
      riskScore: riskAssessment.riskScore,
      confidence: riskAssessment.confidence,
      
      contaminationFindings: [],
      healthConcerns: [],
      preventionRecommendations: []
    };

    // Generate specific findings based on risk level
    switch (riskAssessment.riskLevel) {
      case 'low_risk':
        analysis.contaminationFindings.push('No significant microplastic contamination detected');
        analysis.contaminationFindings.push('Food appears to be naturally processed');
        analysis.preventionRecommendations.push('Continue current food preparation methods');
        break;
        
      case 'moderate_risk':
        analysis.contaminationFindings.push('Some potential microplastic indicators present');
        analysis.contaminationFindings.push('May indicate processed or packaged food');
        analysis.healthConcerns.push('Long-term exposure risk');
        analysis.preventionRecommendations.push('Rinse food thoroughly before consumption');
        analysis.preventionRecommendations.push('Choose fresh, unpackaged alternatives when possible');
        break;
        
      case 'high_risk':
        analysis.contaminationFindings.push('Significant microplastic contamination indicators');
        analysis.contaminationFindings.push('Synthetic material contamination likely');
        analysis.healthConcerns.push('Moderate exposure to microplastics');
        analysis.healthConcerns.push('Potential for ingestion of plastic particles');
        analysis.preventionRecommendations.push('Avoid consumption of highly processed foods');
        analysis.preventionRecommendations.push('Filter water used in food preparation');
        break;
        
      case 'critical_risk':
        analysis.contaminationFindings.push('Critical microplastic contamination detected');
        analysis.contaminationFindings.push('High levels of plastic particles present');
        analysis.healthConcerns.push('High microplastic exposure risk');
        analysis.healthConcerns.push('Potential for serious health impacts');
        analysis.preventionRecommendations.push('Do not consume food item');
        analysis.preventionRecommendations.push('Report to food safety authorities');
        analysis.preventionRecommendations.push('Choose certified microplastic-free alternatives');
        break;
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
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.globalAveragePooling2d(),
        
        tf.layers.dense({
          units: 256,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({
          units: this.numClasses,
          activation: 'softmax'
        })
      ]
    });
  }
}

module.exports = MicroplasticsModel;