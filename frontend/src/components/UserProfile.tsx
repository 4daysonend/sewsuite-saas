// sewsuite-saas/frontend/src/components/UserProfile.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  preferences?: {
    theme?: string;
    notifications?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };
  };
  fullName?: string;
}

interface StorageQuota {
  totalSpace: number;
  usedSpace: number;
  percentage: number;
}

const UserProfile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    theme: 'light',
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        // Assuming userId is stored in localStorage after login
        const userId = localStorage.getItem('userId') || '';
        const token = localStorage.getItem('token') || '';
        
        const userResponse = await axios.get(`/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const quotaResponse = await axios.get(`/api/users/${userId}/quota`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setUser(userResponse.data);
        setQuota(quotaResponse.data);
        
        // Initialize form data from user data
        setFormData({
          firstName: userResponse.data.firstName || '',
          lastName: userResponse.data.lastName || '',
          theme: userResponse.data.preferences?.theme || 'light',
          emailNotifications: userResponse.data.preferences?.notifications?.email ?? true,
          smsNotifications: userResponse.data.preferences?.notifications?.sms ?? false,
          pushNotifications: userResponse.data.preferences?.notifications?.push ?? true,
        });
      } catch (err) {
        setError('Failed to load user data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const userId = localStorage.getItem('userId') || '';
      const token = localStorage.getItem('token') || '';
      
      // Update profile information
      const profileResponse = await axios.put(
        `/api/users/${userId}`,
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Update preferences
      const preferencesResponse = await axios.patch(
        `/api/users/${userId}/preferences`,
        {
          theme: formData.theme,
          notifications: {
            email: formData.emailNotifications,
            sms: formData.smsNotifications,
            push: formData.pushNotifications,
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Update local state
      setUser(profileResponse.data);
      setIsEditing(false);
      
      // Show success message
      alert('Profile updated successfully');
    } catch (err) {
      setError('Failed to update profile');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  if (!user) {
    return <div className="text-center text-gray-600">User not found</div>;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden max-w-4xl mx-auto">
      <div className="p-6 sm:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">User Profile</h1>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email (cannot be changed here)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={user.email}
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
              />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">Preferences</h3>
              
              <div className="mb-4">
                <label htmlFor="theme" className="block text-sm font-medium text-gray-700 mb-1">
                  Theme
                </label>
                <select
                  id="theme"
                  name="theme"
                  value={formData.theme}
                  onChange={handleInputChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Notification Preferences
                </label>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    name="emailNotifications"
                    checked={formData.emailNotifications}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-700">
                    Email Notifications
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="smsNotifications"
                    name="smsNotifications"
                    checked={formData.smsNotifications}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="smsNotifications" className="ml-2 block text-sm text-gray-700">
                    SMS Notifications
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pushNotifications"
                    name="pushNotifications"
                    checked={formData.pushNotifications}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="pushNotifications" className="ml-2 block text-sm text-gray-700">
                    Push Notifications
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                <p className="mt-1 text-lg text-gray-900">
                  {user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Not set'}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1 text-lg text-gray-900">{user.email}</p>
                <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.emailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user.emailVerified ? 'Verified' : 'Not Verified'}
                </span>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Role</h3>
                <p className="mt-1 text-lg text-gray-900 capitalize">{user.role}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Account Status</h3>
                <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">Preferences</h3>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Theme</h4>
                  <p className="mt-1 text-gray-900 capitalize">{user.preferences?.theme || 'Light'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Notifications</h4>
                  <ul className="mt-1 space-y-1">
                    <li className="text-gray-900">
                      Email: {user.preferences?.notifications?.email === false ? 'Disabled' : 'Enabled'}
                    </li>
                    <li className="text-gray-900">
                      SMS: {user.preferences?.notifications?.sms ? 'Enabled' : 'Disabled'}
                    </li>
                    <li className="text-gray-900">
                      Push: {user.preferences?.notifications?.push === false ? 'Disabled' : 'Enabled'}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            {quota && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">Storage Quota</h3>
                
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {formatBytes(quota.usedSpace)} used of {formatBytes(quota.totalSpace)}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {quota.percentage.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        quota.percentage < 60 ? 'bg-blue-500' : 
                        quota.percentage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(quota.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;