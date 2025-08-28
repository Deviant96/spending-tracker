import React from 'react';

interface ParagraphProps {
    children: React.ReactNode;
    size?: 'sm' | 'base' | 'lg';
    weight?: 'normal' | 'medium' | 'semibold' | 'bold';
    color?: 'primary' | 'secondary' | 'muted' | 'error' | 'success';
    className?: string;
}

export const Paragraph: React.FC<ParagraphProps> = ({
    children,
    size = 'base',
    weight = 'normal',
    color = 'primary',
    className = '',
}) => {
    const sizeClasses = {
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-lg',
    };

    const weightClasses = {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold',
    };

    const colorClasses = {
        primary: 'text-gray-900',
        secondary: 'text-gray-700',
        muted: 'text-gray-500',
        error: 'text-red-600',
        success: 'text-green-600',
    };

    return (
        <p
            className={`${sizeClasses[size]} ${weightClasses[weight]} ${colorClasses[color]} ${className}`}
        >
            {children}
        </p>
    );
};

interface TextProps {
    children: React.ReactNode;
    as?: 'span' | 'div' | 'p';
    size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
    weight?: 'thin' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
    color?: 'primary' | 'secondary' | 'muted' | 'error' | 'success' | 'warning';
    align?: 'left' | 'center' | 'right' | 'justify';
    className?: string;
}

export const Text: React.FC<TextProps> = ({
    children,
    as: Component = 'span',
    size = 'base',
    weight = 'normal',
    color = 'primary',
    align = 'left',
    className = '',
}) => {
    const sizeClasses = {
        xs: 'text-xs',
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-lg',
        xl: 'text-xl',
    };

    const weightClasses = {
        thin: 'font-thin',
        light: 'font-light',
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold',
    };

    const colorClasses = {
        primary: 'text-gray-900',
        secondary: 'text-gray-700',
        muted: 'text-gray-500',
        error: 'text-red-600',
        success: 'text-green-600',
        warning: 'text-yellow-600',
    };

    const alignClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        justify: 'text-justify',
    };

    return (
        <Component
            className={`${sizeClasses[size]} ${weightClasses[weight]} ${colorClasses[color]} ${alignClasses[align]} ${className}`}
        >
            {children}
        </Component>
    );
};

interface CodeProps {
    children: React.ReactNode;
    inline?: boolean;
    className?: string;
}

export const Code: React.FC<CodeProps> = ({
    children,
    inline = true,
    className = '',
}) => {
    const baseClasses = 'font-mono bg-gray-100 rounded px-1 py-0.5 text-sm';
    
    if (inline) {
        return (
            <code className={`${baseClasses} ${className}`}>
                {children}
            </code>
        );
    }

    return (
        <pre className={`${baseClasses} block p-4 overflow-x-auto ${className}`}>
            <code>{children}</code>
        </pre>
    );
};

interface LinkProps {
    children: React.ReactNode;
    href: string;
    external?: boolean;
    variant?: 'primary' | 'secondary' | 'muted';
    className?: string;
}

export const Link: React.FC<LinkProps> = ({
    children,
    href,
    external = false,
    variant = 'primary',
    className = '',
}) => {
    const variantClasses = {
        primary: 'text-blue-600 hover:text-blue-800',
        secondary: 'text-gray-600 hover:text-gray-800',
        muted: 'text-gray-500 hover:text-gray-700',
    };

    return (
        <a
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className={`underline transition-colors ${variantClasses[variant]} ${className}`}
        >
            {children}
        </a>
    );
};

interface ListProps {
    children: React.ReactNode;
    ordered?: boolean;
    className?: string;
}

export const List: React.FC<ListProps> = ({
    children,
    ordered = false,
    className = '',
}) => {
    const Component = ordered ? 'ol' : 'ul';
    const baseClasses = ordered ? 'list-decimal' : 'list-disc';

    return (
        <Component className={`${baseClasses} pl-6 space-y-1 ${className}`}>
            {children}
        </Component>
    );
};

interface ListItemProps {
    children: React.ReactNode;
    className?: string;
}

export const ListItem: React.FC<ListItemProps> = ({
    children,
    className = '',
}) => {
    return <li className={className}>{children}</li>;
};

interface BlockquoteProps {
    children: React.ReactNode;
    author?: string;
    className?: string;
}

export const Blockquote: React.FC<BlockquoteProps> = ({
    children,
    author,
    className = '',
}) => {
    return (
        <blockquote className={`border-l-4 border-gray-300 pl-4 italic text-gray-700 ${className}`}>
            {children}
            {author && (
                <footer className="text-sm text-gray-500 mt-2">
                    — {author}
                </footer>
            )}
        </blockquote>
    );
};