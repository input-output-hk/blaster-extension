'use client';
import cn from '../utils/styleUtil';

interface TabProps {
    label: string;
    disabled?: boolean;
}

interface TabsProps {
    tabs: TabProps[];
    activeTab?: number;
    onChange: (activeTab: number) => void;
    direction?: 'vertical' | 'horizontal';
}

export default function Tabs({ direction = 'horizontal', tabs, activeTab, onChange }: TabsProps) {
    
    return <div className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row gap-3'}`}>
        {tabs.map((tab, index) => (
            <button
                key={tab.label}
                id={index.toString()}
                className={cn(`inline-flex items-center justify-center p-2 whitespace-nowrap text-sm font-medium text-onSurface gap-2
                    ${(index !== activeTab) && 'hover:border-b-2 hover:border-outline'} 
                    ${(index === activeTab) && 'border-b-2 border-primary'}`,)}
                onClick={() => onChange(index)}
                disabled={tab.disabled}>
                {tab.label}
            </button>
        ))}
    </div>;
}
