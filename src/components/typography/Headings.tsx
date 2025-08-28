import React from 'react';

interface HeadingProps {
    children: React.ReactNode;
    className?: string;
}

export const H1: React.FC<HeadingProps> = ({ children, className = '' }) => (
    <h1 className={`text-4xl font-bold text-gray-900 mb-5 ${className}`}>
        {children}
    </h1>
);

export const H2: React.FC<HeadingProps> = ({ children, className = '' }) => (
    <h2 className={`text-3xl font-semibold text-gray-800 mb-4 ${className}`}>
        {children}
    </h2>
);

export const H3: React.FC<HeadingProps> = ({ children, className = '' }) => (
    <h3 className={`text-2xl font-medium text-gray-800 mb-3 ${className}`}>
        {children}
    </h3>
);

export const H4: React.FC<HeadingProps> = ({ children, className = '' }) => (
    <h4 className={`text-xl font-medium text-gray-700 mb-2 ${className}`}>
        {children}
    </h4>
);

export const H5: React.FC<HeadingProps> = ({ children, className = '' }) => (
    <h5 className={`text-lg font-medium text-gray-700 mb-2 ${className}`}>
        {children}
    </h5>
);

export const H6: React.FC<HeadingProps> = ({ children, className = '' }) => (
    <h6 className={`text-base font-medium text-gray-600 mb-2 ${className}`}>
        {children}
    </h6>
);