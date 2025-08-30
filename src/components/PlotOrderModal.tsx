import React, { useState, useEffect } from 'react';
import { X, MapPin, Square, FileText, User, Phone, Mail, FileCheck } from 'lucide-react';
import { Plot, OrderData } from '../types/land';

interface PlotOrderModalProps {
  plot: Plot;
  onClose: () => void;
  onSubmit: (orderData: OrderData) => Promise<void>;
}

const PlotOrderModal: React.FC<PlotOrderModalProps> = ({ plot, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<OrderData>({
    first_name: '',
    last_name: '',
    customer_phone: '',
    customer_email: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'details' | 'form'>('details');
  const [errors, setErrors] = useState<Partial<OrderData>>({});

  // Auto-populate intended use from plot data
  useEffect(() => {
    // Intended use is now derived from plot data, no need to store in order
  }, [plot]);

  // Phone number validation for Tanzania
  const validatePhoneNumber = (phone: string): string | null => {
    if (!phone || phone.trim().length < 10) {
      return 'Phone number must be at least 10 characters long';
    }
    
    const cleanPhone = phone.trim().replace(/\s+/g, '').replace(/-/g, '');
    
    // Check if it starts with valid Tanzania prefixes
    if (!cleanPhone.startsWith('+255') && !cleanPhone.startsWith('255') && !cleanPhone.startsWith('0')) {
      return 'Phone number must start with +255, 255, or 0 for Tanzania';
    }
    
    // Additional validation for common Tanzania mobile prefixes
    const tanzaniaPrefixes = ['+2556', '+2557', '+25571', '+25574', '+25575', '+25576', '+25578', '2556', '2557', '25571', '25574', '25575', '25576', '25578', '06', '07', '071', '074', '075', '076', '078'];
    
    const hasValidPrefix = tanzaniaPrefixes.some(prefix => cleanPhone.startsWith(prefix));
    if (!hasValidPrefix) {
      return 'Please enter a valid Tanzania mobile number (e.g., +255712345678 or 0712345678)';
    }
    
    return null;
  };

  // Email validation
  const validateEmail = (email: string | undefined): string | null => {
    if (!email || !email.trim()) {
      return 'Email address is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  // Name validation
  const validateName = (name: string): string | null => {
    if (!name || name.trim().length < 2) {
      return 'Name must be at least 2 characters long';
    }
    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<OrderData> = {};
    
    const firstNameError = validateName(formData.first_name);
    if (firstNameError) newErrors.first_name = firstNameError;
    
    const lastNameError = validateName(formData.last_name);
    if (lastNameError) newErrors.last_name = lastNameError;
    
    const phoneError = validatePhoneNumber(formData.customer_phone);
    if (phoneError) newErrors.customer_phone = phoneError;
    
    const emailError = validateEmail(formData.customer_email);
    if (emailError) newErrors.customer_email = emailError;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error for this field when user starts typing
    if (errors[name as keyof OrderData]) {
      setErrors({
        ...errors,
        [name]: undefined
      });
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let error: string | null = null;
    
    switch (name) {
      case 'first_name':
      case 'last_name':
        error = validateName(value);
        break;
      case 'customer_phone':
        error = validatePhoneNumber(value);
        break;
      case 'customer_email':
        error = validateEmail(value);
        break;
    }
    
    setErrors({
      ...errors,
      [name]: error || undefined
    });
  };

  // Extract additional attributes from shapefile data
  const getAttributeValue = (key: string, defaultValue: string = 'N/A') => {
    return plot.attributes?.[key] || defaultValue;
  };

  const plotDetails = {
    blockNumber: getAttributeValue('Block_numb', 'N/A'),
    locality: getAttributeValue('Locality', 'N/A'),
    council: getAttributeValue('Council', 'N/A'),
    region: getAttributeValue('Region', 'N/A'),
    landUse: getAttributeValue('Land_use', 'N/A'),
    tpNumber: getAttributeValue('tp_number', 'N/A'),
    unit: getAttributeValue('Unit', 'Sqm'),
    fid: getAttributeValue('fid', 'N/A'),
    regPn: getAttributeValue('reg_pn', 'N/A'),
    plotNumber: getAttributeValue('Plot_Numb', 'N/A'),
    calArea: getAttributeValue('Cal_Area', plot.area_hectares?.toString() || 'N/A'),
    // Convert hectares to square meters for display
    areaSquareMeters: plot.area_hectares ? (plot.area_hectares * 10000).toLocaleString() : 'N/A'
  };

  if (currentStep === 'details') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                <MapPin className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Plot Details</h2>
                <p className="text-sm text-gray-600">Review plot information before ordering</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Plot Information Summary */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Square className="w-5 h-5 mr-2 text-green-600" />
                  Basic Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plot Code:</span>
                    <span className="font-medium">{plot.plot_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Area:</span>
                    <span className="font-medium">{plotDetails.areaSquareMeters} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Block Number:</span>
                    <span className="font-medium">{plotDetails.blockNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plot Number:</span>
                    <span className="font-medium">{plotDetails.plotNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium capitalize text-green-600">{plot.status}</span>
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                  Location Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Region:</span>
                    <span className="font-medium">{plotDetails.region}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">District:</span>
                    <span className="font-medium">{plot.district}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Council:</span>
                    <span className="font-medium">{plotDetails.council}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ward:</span>
                    <span className="font-medium">{plot.ward}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Village/Locality:</span>
                    <span className="font-medium">{plotDetails.locality}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <FileCheck className="w-5 h-5 mr-2 text-purple-600" />
                Registration & Land Use
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Registration PN:</span>
                  <span className="font-medium">{plotDetails.regPn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">TP Number:</span>
                  <span className="font-medium">{plotDetails.tpNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Land Use:</span>
                  <span className="font-medium">{plotDetails.landUse}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">FID:</span>
                  <span className="font-medium">{plotDetails.fid}</span>
                </div>
              </div>
            </div>

            {/* Intended Use Selection */}
            <div className="mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Intended Use</h4>
                <p className="text-sm text-gray-600">Will be determined from plot data</p>
                <p className="text-xs text-gray-500 mt-1">No need to specify - derived from plot details</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('form')}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Proceed to Order</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Complete Your Order</h2>
              <p className="text-sm text-gray-600">Plot Code: {plot.plot_code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Order Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  required
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.first_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your first name"
                />
              </div>
              {errors.first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  required
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.last_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your last name"
                />
              </div>
              {errors.last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>
              )}
            </div>            <div>
              <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  id="customer_phone"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  required
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.customer_phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="+255712345678 or 0712345678"
                />
              </div>
              {errors.customer_phone && (
                <p className="mt-1 text-sm text-red-600">{errors.customer_phone}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Enter a valid Tanzania mobile number (e.g., +255712345678, 0712345678)
              </p>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  id="customer_email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  required
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.customer_email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="your.email@example.com"
                />
              </div>
              {errors.customer_email && (
                <p className="mt-1 text-sm text-red-600">{errors.customer_email}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep('details')}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              ← Back to Details
            </button>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Securing Plot...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Secure This Plot</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlotOrderModal;