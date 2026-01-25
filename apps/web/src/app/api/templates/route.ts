import { NextRequest, NextResponse } from 'next/server';
import {
  SCHEDULE_TEMPLATES,
  getTemplateById,
  getFeaturedTemplates,
  getTemplatesByCategory,
  searchTemplates,
  getCategories,
} from '@/lib/schedule-templates';

/**
 * GET /api/templates
 *
 * Fetch schedule templates with optional filtering
 *
 * Query params:
 * - featured: boolean - Only return featured templates
 * - category: string - Filter by category
 * - search: string - Search by name/description/tags
 * - id: string - Get a specific template by ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const id = searchParams.get('id');
    const featured = searchParams.get('featured') === 'true';
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Get specific template by ID
    if (id) {
      const template = getTemplateById(id);
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ template });
    }

    // Get featured templates
    if (featured) {
      const templates = getFeaturedTemplates();
      return NextResponse.json({
        templates,
        count: templates.length,
        featured: true,
      });
    }

    // Filter by category
    if (category) {
      const templates = getTemplatesByCategory(
        category as 'lighting' | 'climate' | 'irrigation' | 'general'
      );
      return NextResponse.json({
        templates,
        count: templates.length,
        category,
      });
    }

    // Search templates
    if (search) {
      const templates = searchTemplates(search);
      return NextResponse.json({
        templates,
        count: templates.length,
        search,
      });
    }

    // Return all templates with category info
    const categories = getCategories();
    return NextResponse.json({
      templates: SCHEDULE_TEMPLATES,
      count: SCHEDULE_TEMPLATES.length,
      categories,
    });
  } catch (error) {
    console.error('[Templates API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch templates',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
