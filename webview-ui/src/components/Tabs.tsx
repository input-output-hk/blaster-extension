'use client';
import type { ChangeEvent } from 'react';
import cn from '../utils/styleUtil';

interface TabProps {
    label: string;
    disabled?: boolean;
}

interface TabsProps {
    tabs: TabProps[];
    activeTab?: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    direction?: 'vertical' | 'horizontal';
}

export default function Tabs({ direction = 'horizontal', tabs, activeTab, onChange }: TabsProps) {
    
    return <div className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row gap-3'}`}>
        {tabs.map((tab) => (
            <button
                key={tab.label}
                id={tab.label}
                className={cn(`inline-flex items-center justify-center p-2 whitespace-nowrap text-sm font-medium text-onSurface gap-2
                    ${(tab.label !== activeTab) && 'hover:border-b-2 hover:border-outline'} 
                    ${(tab.label === activeTab) && 'border-b-2 border-primary'}`,)}
                onClick={(e) => onChange(e as unknown as ChangeEvent<HTMLInputElement>)}
                disabled={tab.disabled}>
                {tab.label}
            </button>
        ))}
    </div>;
}
