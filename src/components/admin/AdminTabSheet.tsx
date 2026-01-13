'use client';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface AdminTabSheetProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function AdminTabSheet({ tabs, activeTab, onTabChange }: AdminTabSheetProps) {
  const [open, setOpen] = useState(false);
  const currentTab = tabs.find(t => t.id === activeTab);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full justify-between md:hidden">
          <span className="flex items-center gap-2">
            {currentTab?.icon}
            {currentTab?.label || 'Select Tab'}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto">
        <div className="grid gap-2 py-4">
          {tabs.map(tab => (
            <Button
              key={tab.id}
              variant={tab.id === activeTab ? "default" : "ghost"}
              className="justify-start"
              onClick={() => {
                onTabChange(tab.id);
                setOpen(false);
              }}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
