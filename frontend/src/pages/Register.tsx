import React from 'react';
import { Helmet } from 'react-helmet-async';
import RegisterForm from '../components/auth/RegisterForm';
import AuthLayout from '../layouts/AuthLayout';

const RegisterPage: React.FC = () => {
  return (
    <AuthLayout>
      <Helmet>
        <title>Register - SewSuite</title>
        <meta name="description" content="Create an account on SewSuite" />
      </Helmet>
      
      <div className="max-w-md w-full mx-auto">
        <RegisterForm />
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;