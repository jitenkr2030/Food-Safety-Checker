const tf = require('@tensorflow/tfjs-node');
const FoodSafetyBaseModel = require('./FoodSafetyBaseModel');

/**
 * Temperature Safety Model for Food Items
 * Estimates if food is at safe serving temperature
 */
class TemperatureSafetyModel extends FoodSafetyBaseModel {
  constructor() {
    super({
      modelType: 'temperature_safety',
      inputShape: [224, 224, 3],
      numClasses: 4, // Safe Hot, Safe Cold, Too Hot, Too Cold
      classes: [
        'safe_hot',      // 60-74°C (serving temperature)
        'safe_cold',     // 0-5°C (refrigerated)
        'too_hot',       // >74°C (dangerously hot)
        'dangerous_temp' // <0°C or ambient in danger zone
      ]
    });
  }

  extractTemperatureFeatures(imageTensor) {
    return tf.tidy(() => {
      const colorFeatures = this.analyzeHeatIndicators(imageTensor);
      const steamFeatures = this.detectSteamVapor(imageTensor);
      const textureFeatures = this.analyzeThermalTexture(imageTensor);
      
      return tf.concat([colorFeatures, steamFeatures, textureFeatures], 0);
    });
  }

  analyzeHeatIndicators(imageTensor) {
    return tf.tidy(() => {
      // Hot foods typically show certain color characteristics
      const hsv = tf.image.rgbToHsv(imageTensor);
      
      // Bright, saturated colors (hot cooked food)
      const brightness = hsv.slice([0, 0, 2], [224, 224, 1]);
      const saturation = hsv.slice([0, 0, 1], [224, 224, 1]);
      
      const avgBrightness = brightness.mean();
      const avgSaturation = saturation.mean();
      
      // Red/orange tints (heat-induced browning)
      const redChannel = imageTensor.slice([0, 0, 0], [224, 224, 1]);
      const greenChannel = imageTensor.slice([0, 0, 1], [224, 224, 1]);
      
      const heatIndicator = redChannel.div(greenChannel.add(1e-7));
      const heatLevel = heatIndicator.mean();
      
      // Clean up
      hsv.dispose();
      brightness.dispose();
      saturation.dispose();
      redChannel.dispose();
      greenChannel.dispose();
      heatIndicator.dispose();
      
      return tf.tensor([avgBrightness.dataSync()[0], avgSaturation.dataSync()[0], 
                       heatLevel.dataSync()[0]]);
    });
  }

  detectSteamVapor(imageTensor) {
    return tf.tidy(() => {
      // Steam appears as light, diffuse areas
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Detect steam-like patterns (high variance, medium brightness)
      const mean = grayImage.mean();
      const variance = grayImage.sub(mean).square().mean();
      
      // Steam typically shows moderate brightness
      const steamMask = grayImage.greater(0.3).logicalAnd(grayImage.less(0.7));
      const steamDensity = steamMask.mean();
      
      // Clean up
      grayImage.dispose();
      steamMask.dispose();
      
      return tf.tensor([variance.dataSync()[0], steamDensity.dataSync()[0]]);
    });
  }

  analyzeThermalTexture(imageTensor) {
    return tf.tidy(() => {
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Hot foods often show glossy/smooth texture
      const sobelX = tf.image.sobelEdges(grayImage).slice([0, 0, 0], [224, 224, 1, 1]);
      const sobelY = tf.image.sobelEdges(grayImage).slice([0, 0, 1], [224, 224, 1, 1]);
      
      const edgeMagnitude = tf.sqrt(sobelX.square().add(sobelY.square()));
      const glossiness = 1 - edgeMagnitude.mean(); // Less edges = more glossy
      
      // Cold foods may show condensation
      const brightSpots = grayImage.greater(0.8);
      const condensationRatio = brightSpots.mean();
      
      // Clean up
      grayImage.dispose();
      sobelX.dispose();
      sobelY.dispose();
      edgeMagnitude.dispose();
      brightSpots.dispose();
      
      return tf.tensor([glossiness.dataSync()[0], condensationRatio.dataSync()[0]]);
    });
  }

  async predict(imagePath) {
    try {
      const preprocessedImage = await this.preprocessImage(imagePath);
      const features = this.extractTemperatureFeatures(preprocessedImage);
      const temperatureEstimate = this.estimateTemperature(features);
      
      const detailedAnalysis = this.generateTemperatureAnalysis(temperatureEstimate);
      
      preprocessedImage.dispose();
      features.dispose();
      
      return {
        ...detailedAnalysis,
        temperatureProfile: temperatureEstimate,
        safetyLevel: temperatureEstimate.safetyLevel
      };
    } catch (error) {
      throw new Error(`Temperature safety prediction failed: ${error.message}`);
    }
  }

  estimateTemperature(features) {
    return tf.tidy(() => {
      const f = features.dataSync();
      
      const brightness = f[0];
      const saturation = f[1];
      const heatLevel = f[2];
      const steamDensity = f[4];
      const glossiness = f[5];
      const condensation = f[6];
      
      // Temperature estimation logic
      let temperature = 25; // Base ambient temperature
      let safetyClass = 'dangerous_temp';
      let riskLevel = 'high';
      
      // Hot food indicators
      if (brightness > 0.6 && saturation > 0.4 && heatLevel > 1.2) {
        if (steamDensity > 0.15) {
          temperature = 80; // Very hot (steam rising)
          safetyClass = 'too_hot';
          riskLevel = 'high';
        } else if (glossiness > 0.7) {
          temperature = 65; // Safe serving temperature
          safetyClass = 'safe_hot';
          riskLevel = 'low';
        } else {
          temperature = 50; // Warm
          safetyClass = 'safe_hot';
          riskLevel = 'low';
        }
      }
      // Cold food indicators
      else if (condensation > 0.1 || brightness > 0.8) {
        temperature = 3; // Refrigerated
        safetyClass = 'safe_cold';
        riskLevel = 'low';
      }
      // Ambient temperature (danger zone for food safety)
      else {
        temperature = 25; // Room temperature
        safetyClass = 'dangerous_temp';
        riskLevel = 'high';
      }
      
      return {
        estimatedTemperature: Math.round(temperature),
        safetyClass,
        riskLevel,
        safetyLevel: riskLevel === 'low' ? 'safe' : riskLevel === 'moderate' ? 'caution' : 'unsafe',
        recommendations: this.getTemperatureRecommendations(safetyClass, temperature)
      };
    });
  }

  getTemperatureRecommendations(safetyClass, temperature) {
    const recommendations = [];
    
    switch (safetyClass) {
      case 'too_hot':
        recommendations.push('Let food cool before serving');
        recommendations.push('Risk of burns - handle with care');
        break;
      case 'safe_hot':
        recommendations.push('Food is at appropriate serving temperature');
        recommendations.push('Safe for immediate consumption');
        break;
      case 'safe_cold':
        recommendations.push('Food is properly refrigerated');
        recommendations.push('Safe cold storage temperature');
        break;
      case 'dangerous_temp':
        recommendations.push('Food in danger zone - consume within 2 hours');
        recommendations.push('Reheat to safe temperature or refrigerate');
        break;
    }
    
    return recommendations;
  }

  generateTemperatureAnalysis(temperatureEstimate) {
    const analysis = {
      temperatureStatus: temperatureEstimate.safetyClass,
      estimatedTemp: temperatureEstimate.estimatedTemperature,
      riskLevel: temperatureEstimate.riskLevel,
      
      safetyFindings: [],
      healthRisks: [],
      handlingRecommendations: temperatureEstimate.recommendations
    };

    // Generate specific findings
    switch (temperatureEstimate.safetyClass) {
      case 'too_hot':
        analysis.safetyFindings.push('Food temperature exceeds safe serving level');
        analysis.healthRisks.push('Risk of oral burns and throat injury');
        analysis.healthRisks.push('May continue cooking food internally');
        break;
      case 'safe_hot':
        analysis.safetyFindings.push('Food at appropriate hot serving temperature');
        analysis.healthRisks.push('Safe for consumption');
        break;
      case 'safe_cold':
        analysis.safetyFindings.push('Food properly refrigerated');
        analysis.healthRisks.push('Bacterial growth inhibited');
        break;
      case 'dangerous_temp':
        analysis.safetyFindings.push('Food in temperature danger zone');
        analysis.safetyFindings.push('Between 5°C and 60°C - rapid bacterial growth');
        analysis.healthRisks.push('High risk of foodborne illness');
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
          units: 128,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: this.numClasses,
          activation: 'softmax'
        })
      ]
    });
  }
}

module.exports = TemperatureSafetyModel;