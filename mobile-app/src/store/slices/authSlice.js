import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '../services/authService';
import { AnalyticsService } from '../services/analyticsService';

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await AuthService.login(email, password);
      
      // Track login success
      AnalyticsService.trackEvent('login_success', {
        method: 'email',
      });

      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      
      // Track login failure
      AnalyticsService.trackEvent('login_failure', {
        method: 'email',
        error: message,
      });

      return rejectWithValue(message);
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await AuthService.register(userData);
      
      // Track registration
      AnalyticsService.trackEvent('registration_success');

      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Registration failed';
      
      // Track registration failure
      AnalyticsService.trackEvent('registration_failure', {
        error: message,
      });

      return rejectWithValue(message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    try {
      const { auth } = getState();
      
      // Logout from backend
      await AuthService.logout(auth.refreshToken);
      
      // Clear local storage
      await AsyncStorage.multiRemove([
        'authToken',
        'refreshToken',
        'userData',
      ]);

      // Track logout
      AnalyticsService.trackEvent('logout');

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local storage even if backend logout fails
      await AsyncStorage.multiRemove([
        'authToken',
        'refreshToken',
        'userData',
      ]);
      return true;
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const response = await AuthService.refreshToken(auth.refreshToken);
      
      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Token refresh failed';
      return rejectWithValue(message);
    }
  }
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async (token, { rejectWithValue }) => {
    try {
      const response = await AuthService.verifyEmail(token);
      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Email verification failed';
      return rejectWithValue(message);
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email, { rejectWithValue }) => {
    try {
      const response = await AuthService.forgotPassword(email);
      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Password reset failed';
      return rejectWithValue(message);
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ token, password }, { rejectWithValue }) => {
    try {
      const response = await AuthService.resetPassword(token, password);
      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Password reset failed';
      return rejectWithValue(message);
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await AuthService.updateProfile(userData);
      
      // Track profile update
      AnalyticsService.trackEvent('profile_updated');

      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Profile update failed';
      return rejectWithValue(message);
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const response = await AuthService.changePassword(currentPassword, newPassword);
      
      // Track password change
      AnalyticsService.trackEvent('password_changed');

      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Password change failed';
      return rejectWithValue(message);
    }
  }
);

export const enableTwoFactor = createAsyncThunk(
  'auth/enableTwoFactor',
  async (_, { rejectWithValue }) => {
    try {
      const response = await AuthService.enableTwoFactor();
      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || '2FA setup failed';
      return rejectWithValue(message);
    }
  }
);

export const verifyTwoFactor = createAsyncThunk(
  'auth/verifyTwoFactor',
  async (token, { rejectWithValue }) => {
    try {
      const response = await AuthService.verifyTwoFactor(token);
      return response;
    } catch (error) {
      const message = error.response?.data?.message || error.message || '2FA verification failed';
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isEmailVerified: false,
  twoFactorEnabled: false,
  isPremium: false,
  premiumExpiresAt: null,
  sessionId: null,
  lastLoginAt: null,
  loginAttempts: 0,
  accountLocked: false,
  emailVerificationSent: false,
  passwordResetSent: false,
  twoFactorSetup: null,
};

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    },
    setEmailVerificationSent: (state, action) => {
      state.emailVerificationSent = action.payload;
    },
    setPasswordResetSent: (state, action) => {
      state.passwordResetSent = action.payload;
    },
    setAccountLocked: (state, action) => {
      state.accountLocked = action.payload;
    },
    resetAuth: (state) => {
      // Reset to initial state
      Object.assign(state, initialState);
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.isEmailVerified = action.payload.user.emailVerified;
        state.twoFactorEnabled = action.payload.user.twoFactorEnabled;
        state.isPremium = action.payload.user.isPremium;
        state.premiumExpiresAt = action.payload.user.premiumExpiresAt;
        state.lastLoginAt = new Date().toISOString();
        state.loginAttempts = 0;
        state.accountLocked = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
        state.loginAttempts += 1;
        
        // Lock account after 5 failed attempts
        if (state.loginAttempts >= 5) {
          state.accountLocked = true;
        }
      })

      // Register
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.isEmailVerified = false;
        state.emailVerificationSent = true;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })

      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        Object.assign(state, initialState);
      })

      // Refresh token
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(refreshToken.rejected, (state) => {
        Object.assign(state, initialState);
      })

      // Verify email
      .addCase(verifyEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isEmailVerified = true;
        state.user = { ...state.user, emailVerified: true };
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Forgot password
      .addCase(forgotPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.passwordResetSent = true;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Reset password
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.passwordResetSent = false;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Update profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = { ...state.user, ...action.payload.user };
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Change password
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Enable two factor
      .addCase(enableTwoFactor.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(enableTwoFactor.fulfilled, (state, action) => {
        state.isLoading = false;
        state.twoFactorSetup = action.payload;
      })
      .addCase(enableTwoFactor.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Verify two factor
      .addCase(verifyTwoFactor.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyTwoFactor.fulfilled, (state) => {
        state.isLoading = false;
        state.twoFactorEnabled = true;
        state.twoFactorSetup = null;
      })
      .addCase(verifyTwoFactor.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// Export actions
export const {
  clearError,
  setLoading,
  setUser,
  setToken,
  setEmailVerificationSent,
  setPasswordResetSent,
  setAccountLocked,
  resetAuth,
} = authSlice.actions;

// Selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.isLoading;
export const selectAuthError = (state) => state.auth.error;
export const selectIsEmailVerified = (state) => state.auth.isEmailVerified;
export const selectIsPremium = (state) => state.auth.isPremium;
export const selectTwoFactorEnabled = (state) => state.auth.twoFactorEnabled;
export const selectAccountLocked = (state) => state.auth.accountLocked;

export default authSlice.reducer;