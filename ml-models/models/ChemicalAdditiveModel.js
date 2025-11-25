const tf = require('@tensorflow/tfjs-node');
const FoodSafetyBaseModel = require('./FoodSafetyBaseModel');

/**
 * Chemical Additive Detection Model for Indian Foods
 * Identifies potential artificial colors, preservatives, and harmful chemicals
 */
class ChemicalAdditiveModel extends FoodSafetyBaseModel {
  constructor() {
    super({
      modelType: 'chemical_additives',
      inputShape: [224, 224, 3],
      numClasses: 5, // Natural, Minimal Additives, Preservatives, Artificial Colors, Harmful Chemicals
      classes: [
        'natural_food',         // No artificial additives
        'minimal_additives',    // Natural preservatives only
        'preservatives',        // Chemical preservatives present
        'artificial_colors',    // Artificial colorants detected
        'harmful_chemicals'     // Potentially harmful chemicals
      ]
    });
  }

  extractChemicalFeatures(imageTensor) {
    return tf.tidy(() => {
      const colorFeatures = this.analyzeArtificialColors(imageTensor);
      const textureFeatures = this.analyzeChemicalTexture(imageTensor);
      const surfaceFeatures = this.analyzeSurfaceIndicators(imageTensor);
      
      return tf.concat([colorFeatures, textureFeatures, surfaceFeatures], 0);
    });
  }

  analyzeArtificialColors(imageTensor) {
    return tf.tidy(() => {
      // Unnatural colors often indicate artificial additives
      const hsv = tf.image.rgbToHsv(imageTensor);
      
      // Bright, saturated unnatural colors
      const saturation = hsv.slice([0, 0, 1], [224, 224, 1]);
      const brightness = hsv.slice([0, 0, 2], [224, 224, 1]);
      const hue = hsv.slice([0, 0, 0], [224, 224, 1]);
      
      // Artificial colors tend to be overly bright and saturated
      const artificialMask = saturation.greater(0.7).logicalAnd(brightness.greater(0.6));
      const artificialRatio = artificialMask.mean();
      
      // Detect unusual color combinations
      const unusualColors = this.detectUnusualColorCombinations(hsv);
      
      // Clean up
      hsv.dispose();
      saturation.dispose();
      brightness.dispose();
      hue.dispose();
      artificialMask.dispose();
      
      return tf.tensor([artificialRatio.dataSync()[0], unusualColors.dataSync()[0]]);
    });
  }

  detectUnusualColorCombinations(hsvImage) {
    return tf.tidy(() => {
      const hue = hsvImage.slice([0, 0, 0], [224, 224, 1]);
      const saturation = hsvImage.slice([0, 0, 1], [224, 224, 1]);
      const brightness = hsvImage.slice([0, 0, 2], [224, 224, 1]);
      
      // Detect neon-like colors (high saturation + high brightness)
      const neonMask = saturation.greater(0.8).logicalAnd(brightness.greater(0.7));
      const neonRatio = neonMask.mean();
      
      // Clean up
      hue.dispose();
      saturation.dispose();
      brightness.dispose();
      neonMask.dispose();
      
      return neonRatio;
    });
  }

  analyzeChemicalTexture(imageTensor) {
    return tf.tidy(() => {
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Artificial additives can create unusual texture patterns
      const edgeMagnitude = this.calculateEdgeDensity(grayImage);
      
      // Uniform artificial texture (indicating additives)
      const localVariance = this.calculateLocalVariance(grayImage);
      const uniformity = 1 / (localVariance.add(1e-7)); // Inverse of variance = uniformity
      
      // Smooth artificial coating
      const smoothAreas = grayImage.greater(0.4).logicalAnd(grayImage.less(0.7));
      const smoothRatio = smoothAreas.mean();
      
      // Clean up
      grayImage.dispose();
      smoothAreas.dispose();
      
      return tf.tensor([edgeMagnitude.dataSync()[0], uniformity.dataSync()[0], 
                       smoothRatio.dataSync()[0]]);
    });
  }

  calculateEdgeDensity(imageTensor) {
    return tf.tidy(() => {
      const sobelX = tf.image.sobelEdges(imageTensor).slice([0, 0, 0], [224, 224, 1, 1]);
      const sobelY = tf.image.sobelEdges(imageTensor).slice([0, 0, 1], [224, 224, 1, 1]);
      const edgeMagnitude = tf.sqrt(sobelX.square().add(sobelY.square()));
      
      sobelX.dispose();
      sobelY.dispose();
      
      return edgeMagnitude;
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

  analyzeSurfaceIndicators(imageTensor) {
    return tf.tidy(() => {
      // Look for artificial coating or preservation layers
      const brightness = imageTensor.mean(-1);
      
      // Shiny artificial coating
      const highlightMask = brightness.greater(0.8);
      const coatingRatio = highlightMask.mean();
      
      // Color uniformity (additives often create uniform color)
      const colorVariance = brightness.sub(brightness.mean()).square().mean();
      const uniformity = 1 / (colorVariance.add(1e-7));
      
      // Clean up
      brightness.dispose();
      highlightMask.dispose();
      
      return tf.tensor([coatingRatio.dataSync()[0], uniformity.dataSync()[0]]);
    });
  }

  async predict(imagePath) {
    try {
      const preprocessedImage = await this.preprocessImage(imagePath);
      const features = this.extractChemicalFeatures(preprocessedImage);
      const chemicalAssessment = this.assessChemicalAdditives(features);
      
      const detailedAnalysis = this.generateChemicalAnalysis(chemicalAssessment);
      
      preprocessedImage.dispose();
      features.dispose();
      
      return {
        ...detailedAnalysis,
        chemicalProfile: chemicalAssessment,
        riskLevel: chemicalAssessment.riskLevel
      };
    } catch (error) {
      throw new Error(`Chemical additive prediction failed: ${error.message}`);
    }
  }

  assessChemicalAdditives(features) {
    return tf.tidy(() => {
      const f = features.dataSync();
      
      const artificialRatio = f[0];
      const neonRatio = f[1];
      const edgeDensity = f[2];
      const uniformity = f[3];
      const smoothRatio = f[4];
      const coatingRatio = f[6];
      
      // Chemical additive assessment
      let classification = 'natural_food';
      let riskLevel = 'low';
      let confidence = 0;
      
      // High artificial colors
      if (artificialRatio > 0.2 || neonRatio > 0.1) {
        classification = 'artificial_colors';
        riskLevel = 'moderate';
        confidence = Math.min((artificialRatio + neonRatio) * 2, 1);
      }
      // Uniform artificial coating
      else if (coatingRatio > 0.15 && uniformity > 2) {
        classification = 'harmful_chemicals';
        riskLevel = 'high';
        confidence = Math.min(coatingRatio * 3, 1);
      }
      // Preservatives (smooth, uniform texture)
      else if (smoothRatio > 0.3 && uniformity > 1.5) {
        classification = 'preservatives';
        riskLevel = 'moderate';
        confidence = Math.min(smoothRatio, 1);
      }
      // Minimal additives
      else if (uniformity > 1.2) {
        classification = 'minimal_additives';
        riskLevel = 'low';
        confidence = Math.min((uniformity - 1) * 2, 1);
      }
      
      return {
        classification,
        riskLevel,
        confidence: Math.round(confidence * 100) / 100,
        indicators: {
          artificialColors: artificialRatio,
          neonColors: neonRatio,
          uniformity: uniformity,
          artificialCoating: coatingRatio
        }
      };
    });
  }

  generateChemicalAnalysis(chemicalAssessment) {
    const analysis = {
      additiveStatus: chemicalAssessment.classification,
      riskLevel: chemicalAssessment.riskLevel,
      confidence: chemicalAssessment.confidence,
      
      specificFindings: [],
      healthConcerns: [],
      recommendations: []
    };

    // Generate specific findings based on classification
    switch (chemicalAssessment.classification) {
      case 'natural_food':
        analysis.specificFindings.push('No artificial additives detected');
        analysis.specificFindings.push('Natural food coloring and preservation');
        analysis.recommendations.push('Safe for consumption');
        break;
        
      case 'minimal_additives':
        analysis.specificFindings.push('Natural preservatives likely present');
        analysis.specificFindings.push('Minimal artificial processing');
        analysis.recommendations.push('Generally safe for most people');
        break;
        
      case 'preservatives':
        analysis.specificFindings.push('Chemical preservatives detected');
        analysis.specificFindings.push('Extended shelf life indicators');
        analysis.healthConcerns.push('May cause sensitivities in some individuals');
        analysis.recommendations.push('Check ingredient list for specific preservatives');
        break;
        
      case 'artificial_colors':
        analysis.specificFindings.push('Artificial food coloring detected');
        analysis.specificFindings.push('Unnatural color intensity and saturation');
        analysis.healthConcerns.push('May trigger allergies in sensitive individuals');
        analysis.healthConcerns.push('Some artificial colors linked to behavioral issues');
        analysis.recommendations.push('Prefer natural alternatives when possible');
        break;
        
      case 'harmful_chemicals':
        analysis.specificFindings.push('Potentially harmful chemicals detected');
        analysis.specificFindings.push('Artificial coating or treatment visible');
        analysis.healthConcerns.push('High risk of chemical exposure');
        analysis.healthConcerns.push('May contain harmful additives');
        analysis.recommendations.push('Avoid consumption');
        analysis.recommendations.push('Report to food safety authorities');
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

module.exports = ChemicalAdditiveModel;