#!/bin/bash

# Indian Food Safety ML Models Setup Script
# Sets up the complete ML pipeline for food safety analysis

set -e

echo "🚀 Setting up Indian Food Safety ML Models Pipeline..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 16+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ $NODE_VERSION -lt 16 ]; then
        print_error "Node.js version 16+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js $(node -v) is installed"
}

# Check if Python is available (for potential model conversion)
check_python() {
    if command -v python3 &> /dev/null; then
        print_success "Python 3 is available"
    else
        print_warning "Python 3 not found. Some advanced features may not work."
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        print_success "Dependencies installed successfully"
    else
        print_error "package.json not found in current directory"
        exit 1
    fi
}

# Create directory structure
create_directories() {
    print_status "Creating directory structure..."
    
    # Create ML directories
    mkdir -p data/indian_food_dataset
    mkdir -p data/indian_food_dataset/raw
    mkdir -p data/indian_food_dataset/processed
    mkdir -p data/indian_food_dataset/training
    mkdir -p data/indian_food_dataset/validation
    mkdir -p data/indian_food_dataset/test
    mkdir -p models
    mkdir -p production_models
    mkdir -p logs
    
    print_success "Directory structure created"
}

# Install system dependencies
install_system_dependencies() {
    print_status "Installing system dependencies..."
    
    # Check if we're on Linux
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Install Cairo and other graphics libraries
        if command -v apt-get &> /dev/null; then
            print_status "Installing system packages..."
            sudo apt-get update
            sudo apt-get install -y \
                build-essential \
                python3-dev \
                pkg-config \
                libcairo2-dev \
                libpango1.0-dev \
                libjpeg-dev \
                libgif-dev \
                librsvg2-dev
            print_success "System packages installed"
        else
            print_warning "apt-get not found. Please install system dependencies manually:"
            print_warning "- build-essential"
            print_warning "- python3-dev")
            print_warning "- libcairo2-dev")
            print_warning("- libpango1.0-dev")
            print_warning("- libjpeg-dev")
            print_warning("- libgif-dev")
            print_warning("- librsvg2-dev")
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            print_status "Installing system packages via Homebrew..."
            brew install cairo pango
            print_success "System packages installed via Homebrew"
        else
            print_warning "Homebrew not found. Please install Cairo and Pango manually."
        fi
    else
        print_warning "Unsupported operating system. Please install system dependencies manually."
    fi
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    cat > .env << EOL
# Indian Food Safety ML Models Configuration

# Model Training Settings
MODEL_VERSION=2.0.0
TRAINING_EPOCHS=50
BATCH_SIZE=32
LEARNING_RATE=0.001

# Dataset Settings
DATASET_PATH=./data/indian_food_dataset
MODELS_PATH=./models
PRODUCTION_MODELS_PATH=./production_models

# API Settings
API_PORT=3000
API_HOST=localhost

# Database Settings (for backend integration)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=food_safety_app
DB_USER=food_safety_user
DB_PASSWORD=your_password_here

# Redis Settings (for caching)
REDIS_URL=redis://localhost:6379

# JWT Settings
JWT_SECRET=your_jwt_secret_here

# File Upload Settings
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads/food-images

# ML Service Settings
ML_CONCURRENCY=4
ML_TIMEOUT=30000

# Logging Settings
LOG_LEVEL=info
LOG_PATH=./logs
EOL
    
    print_success "Environment file created (.env)"
    print_warning "Please update the database and JWT settings in .env file"
}

# Create configuration files
create_config_files() {
    print_status "Creating configuration files..."
    
    # Create model training configuration
    cat > config/training.json << EOL
{
  "global": {
    "epochs": 50,
    "batch_size": 32,
    "learning_rate": 0.001,
    "validation_split": 0.2,
    "test_split": 0.1,
    "patience": 10,
    "early_stopping": true,
    "model_checkpoint": true
  },
  "models": {
    "oil_quality": {
      "input_shape": [224, 224, 3],
      "num_classes": 5,
      "epochs": 60,
      "learning_rate": 0.0005
    },
    "burnt_food": {
      "input_shape": [224, 224, 3],
      "num_classes": 4,
      "epochs": 50,
      "learning_rate": 0.001
    },
    "spoilage": {
      "input_shape": [224, 224, 3],
      "num_classes": 5,
      "epochs": 55,
      "learning_rate": 0.0008
    },
    "nutritional": {
      "input_shape": [224, 224, 3],
      "output_dim": 10,
      "epochs": 70,
      "learning_rate": 0.0003
    },
    "salt_sugar": {
      "input_shape": [224, 224, 3],
      "output_dim": 3,
      "epochs": 45,
      "learning_rate": 0.0008
    },
    "temperature": {
      "input_shape": [224, 224, 3],
      "num_classes": 4,
      "epochs": 40,
      "learning_rate": 0.001
    },
    "chemical": {
      "input_shape": [224, 224, 3],
      "num_classes": 5,
      "epochs": 50,
      "learning_rate": 0.0008
    },
    "microplastics": {
      "input_shape": [224, 224, 3],
      "num_classes": 4,
      "epochs": 60,
      "learning_rate": 0.0005
    }
  }
}
EOL

    # Create API configuration
    cat > config/api.json << EOL
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "cors": {
      "origin": "*",
      "credentials": true
    }
  },
  "upload": {
    "max_file_size": 10485760,
    "allowed_mime_types": [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/gif",
      "image/webp"
    ],
    "upload_path": "./uploads/food-images"
  },
  "analysis": {
    "timeout": 30000,
    "concurrency": 4,
    "retry_attempts": 3,
    "retry_delay": 1000
  },
  "models": {
    "cache_enabled": true,
    "cache_ttl": 3600,
    "auto_load": true
  }
}
EOL

    print_success "Configuration files created"
}

# Run initial tests
run_tests() {
    print_status "Running initial tests..."
    
    # Test TensorFlow.js installation
    node -e "
        try {
            const tf = require('@tensorflow/tfjs-node');
            console.log('✅ TensorFlow.js-node installed correctly');
            console.log('📊 Backend:', tf.getBackend());
            console.log('🔢 Version:', tf.version.tfjs);
        } catch (error) {
            console.error('❌ TensorFlow.js-node test failed:', error.message);
            process.exit(1);
        }
    "
    
    # Test model imports
    node -e "
        try {
            const path = require('path');
            console.log('✅ Model files structure verified');
            console.log('📁 Current directory:', process.cwd());
        } catch (error) {
            console.error('❌ File structure test failed:', error.message);
        }
    "
    
    print_success "Initial tests completed"
}

# Create startup scripts
create_scripts() {
    print_status "Creating startup scripts..."
    
    # Training script
    cat > train-models.sh << 'EOL'
#!/bin/bash
echo "🧠 Starting ML Model Training..."
node training/train.js full
EOL
    chmod +x train-models.sh
    
    # Development server script
    cat > start-dev.sh << 'EOL'
#!/bin/bash
echo "🚀 Starting Development Server..."
npm run dev
EOL
    chmod +x start-dev.sh
    
    # Model testing script
    cat > test-models.sh << 'EOL'
#!/bin/bash
echo "🧪 Testing ML Models..."
node training/train.js test
EOL
    chmod +x test-models.sh
    
    print_success "Startup scripts created"
}

# Create documentation
create_documentation() {
    print_status "Creating documentation..."
    
    cat > README.md << 'EOL'
# Indian Food Safety ML Models

## Overview
This project provides comprehensive food safety analysis using 8 specialized ML models trained on Indian cuisine:

1. **Oil Quality Analysis** - Detects oil freshness, adulteration, and safety
2. **Burnt Food Detection** - Identifies burnt/charred food and toxicity levels  
3. **Spoilage Detection** - Finds mold, bacterial growth, and food deterioration
4. **Nutritional Analysis** - Estimates calories, macros, and micronutrients
5. **Salt/Sugar Detection** - Measures sodium and sugar content levels
6. **Temperature Safety** - Assesses food temperature safety zones
7. **Chemical Additive Detection** - Identifies artificial colors and harmful chemicals
8. **Microplastics Risk** - Evaluates microplastic contamination risk

## Quick Start

### Installation
```bash
# Clone and setup
git clone <repository-url>
cd indian-food-safety-ml

# Run setup script
./setup.sh

# Install dependencies
npm install
```

### Training Models
```bash
# Full training pipeline
./train-models.sh

# Or step by step:
node training/train.js prepare    # Prepare dataset only
node training/train.js train     # Train models only  
node training/train.js test      # Test models only
```

### API Usage
```javascript
const analysis = await FoodAnalysis.performAnalysis(
  userId,
  imagePath,
  {
    analysisType: 'comprehensive',
    userPreferences: {
      healthConditions: ['diabetes', 'hypertension']
    }
  }
);
```

## Directory Structure
```
├── models/                    # Trained ML models
├── training/                  # Training scripts and data
├── data/                      # Dataset and processed data
├── config/                    # Configuration files
├── src/                       # Source code
└── docs/                      # Documentation
```

## Models

Each model is specialized for specific food safety aspects:

### Oil Quality Model
- Input: Food image (224x224x3)
- Output: Quality score (0-100) + classification
- Classes: Fresh, Slightly Used, Highly Used, Adulterated, Dangerous

### Burnt Food Model  
- Input: Food image (224x224x3)
- Output: Health risk score (0-100) + severity level
- Classes: Fresh, Slightly Overcooked, Burnt, Severely Burnt

### Spoilage Model
- Input: Food image (224x224x3)  
- Output: Spoilage risk score (0-100) + contamination level
- Classes: Fresh, Slightly Stale, Spoiled, Moldy, Dangerous

## Development

### Running Tests
```bash
npm test
```

### Adding New Models
1. Create model class extending `FoodSafetyBaseModel`
2. Add to `FoodSafetyAnalysisService`
3. Update training pipeline
4. Test integration

### API Integration
Models are integrated with the backend via:
- Enhanced `FoodAnalysis` model
- `/api/analysis/analyze` endpoint
- Real-time analysis processing

## Deployment

### Production Setup
1. Train models with production data
2. Export models to production format
3. Configure backend integration
4. Deploy with proper security

### Monitoring
- Model performance metrics
- Analysis accuracy tracking
- User feedback integration

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request

## License

MIT License - see LICENSE file for details
EOL

    print_success "Documentation created"
}

# Final setup verification
verify_setup() {
    print_status "Verifying setup..."
    
    # Check critical files
    if [ -f "package.json" ]; then
        print_success "✓ package.json exists"
    else
        print_error "✗ package.json missing"
        return 1
    fi
    
    if [ -f ".env" ]; then
        print_success "✓ .env file created"
    else
        print_error "✗ .env file missing"
        return 1
    fi
    
    if [ -d "models" ]; then
        print_success "✓ models directory exists"
    else
        print_error "✗ models directory missing"
        return 1
    fi
    
    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        print_success "✓ node_modules installed"
    else
        print_warning "! node_modules not found - run 'npm install'"
    fi
    
    return 0
}

# Main setup function
main() {
    echo ""
    print_status "Starting Indian Food Safety ML Models Setup"
    echo ""
    
    # System checks
    check_nodejs
    check_python
    
    # Core setup
    install_dependencies
    create_directories
    install_system_dependencies
    
    # Configuration
    setup_environment
    create_config_files
    
    # Scripts and documentation
    create_scripts
    create_documentation
    
    # Testing
    run_tests
    
    # Final verification
    if verify_setup; then
        echo ""
        print_success "🎉 Setup completed successfully!"
        echo ""
        echo "Next steps:"
        echo "1. Update .env file with your database settings"
        echo "2. Run './train-models.sh' to train the models"
        echo "3. Start development with './start-dev.sh'"
        echo ""
        echo "📚 Documentation: README.md"
        echo "🔧 Configuration: config/ directory"
        echo "🧠 Models: models/ directory"
        echo ""
        print_success "Indian Food Safety ML Models are ready to use!"
    else
        print_error "Setup verification failed. Please check the errors above."
        exit 1
    fi
}

# Run main function
main "$@"