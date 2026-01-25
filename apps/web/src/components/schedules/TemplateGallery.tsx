"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ScheduleTemplate } from '@/types/schedules';

interface TemplateGalleryProps {
  onSelectTemplate: (template: ScheduleTemplate) => void;
  onClose?: () => void;
}

export function TemplateGallery({ onSelectTemplate, onClose }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery, selectedCategory]);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      const data = await response.json();

      if (data.templates) {
        setTemplates(data.templates);
        setFilteredTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterTemplates() {
    let filtered = [...templates];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.metadata?.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setFilteredTemplates(filtered);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Schedule Templates</h2>
          <p className="text-muted-foreground">
            Choose a pre-configured schedule to get started quickly
          </p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="lighting">Lighting</TabsTrigger>
          <TabsTrigger value="climate">Climate</TabsTrigger>
          <TabsTrigger value="irrigation">Irrigation</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No templates found matching your criteria
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => onSelectTemplate(template)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TemplateCardProps {
  template: ScheduleTemplate;
  onSelect: () => void;
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const difficultyColors = {
    beginner: 'bg-green-500/10 text-green-500',
    intermediate: 'bg-yellow-500/10 text-yellow-500',
    advanced: 'bg-red-500/10 text-red-500',
  };

  return (
    <Card className="hover:border-primary transition-colors cursor-pointer" onClick={onSelect}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {template.icon && <span className="text-2xl">{template.icon}</span>}
            <CardTitle className="text-lg">{template.name}</CardTitle>
          </div>
          {template.featured && (
            <Badge variant="secondary" className="text-xs">
              Featured
            </Badge>
          )}
        </div>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Schedules count */}
          <div className="text-sm text-muted-foreground">
            {template.schedules.length} schedule{template.schedules.length !== 1 ? 's' : ''} included
          </div>

          {/* Tags */}
          {template.metadata?.tags && template.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.metadata.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Difficulty */}
          {template.metadata?.difficulty && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Difficulty:</span>
              <Badge
                className={`text-xs ${difficultyColors[template.metadata.difficulty]}`}
              >
                {template.metadata.difficulty}
              </Badge>
            </div>
          )}

          {/* Required devices */}
          {template.metadata?.requiredDevices && template.metadata.requiredDevices.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Requires: {template.metadata.requiredDevices.join(', ')}
            </div>
          )}

          <Button className="w-full" size="sm">
            Use Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
