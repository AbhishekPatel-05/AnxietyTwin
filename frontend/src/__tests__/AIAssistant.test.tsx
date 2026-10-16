import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AIAssistantDrawer } from '../components/AIAssistantDrawer';
import { api } from '../services/api';
import { AIAssistantConfig, AIAssistantMessage } from '../types';

vi.mock('../services/api', () => ({
  api: {
    getAssistantConfig: vi.fn(),
    getAssistantHistory: vi.fn(),
    chatWithAssistant: vi.fn(),
    clearAssistantHistory: vi.fn(),
  },
}));

describe('AIAssistantDrawer Component', () => {
  const mockConfig: AIAssistantConfig = {
    active_provider: 'Grounded Clinical Engine',
    model: 'AnxietyTwin-Clinical-RAG-v2',
    is_live_hosted: false,
    supported_providers: ['Grounded Clinical Engine', 'Google Gemini', 'OpenAI'],
    available_tools: ['get_user_baseline', 'get_recent_observations', 'get_ml_prediction_explanation'],
    safety_guardrail_active: true,
  };

  const mockCsiResponse: AIAssistantMessage = {
    role: 'assistant',
    content: 'The Composite Stress Index (CSI) measures multi-modal physiological and autonomic strain.',
    provenance: ['Authenticated Baseline Engine', 'Platform Architecture Specification'],
    citations: ['AnxietyTwin Clinical Architecture (DOC-CSI-01)'],
    timestamp: '2026-10-11T20:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem('anxietytwin_token', 'test-valid-jwt-token');
    (api.getAssistantConfig as any).mockResolvedValue(mockConfig);
    (api.getAssistantHistory as any).mockResolvedValue({ messages: [] });
    (api.chatWithAssistant as any).mockResolvedValue(mockCsiResponse);
    (api.clearAssistantHistory as any).mockResolvedValue({ status: 'cleared', count: 0 });
  });

  it('renders the floating launcher button by default', () => {
    render(
      <BrowserRouter>
        <AIAssistantDrawer />
      </BrowserRouter>
    );

    const launcherBtn = screen.getByRole('button', { name: /ai clinical assistant/i });
    expect(launcherBtn).toBeInTheDocument();
  });

  it('opens drawer and displays provider status banner and suggestions when clicked', async () => {
    render(
      <BrowserRouter>
        <AIAssistantDrawer />
      </BrowserRouter>
    );

    const launcherBtn = screen.getByRole('button', { name: /ai clinical assistant/i });
    fireEvent.click(launcherBtn);

    expect(screen.getByText(/anxietytwin assistant/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/grounded clinical engine/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/why is my stress score elevated\?/i)).toBeInTheDocument();
  });

  it('sends a user message and renders response with provenance tags and citations', async () => {
    render(
      <BrowserRouter>
        <AIAssistantDrawer />
      </BrowserRouter>
    );

    // Open drawer
    fireEvent.click(screen.getByRole('button', { name: /ai clinical assistant/i }));

    const input = screen.getByPlaceholderText(/ask about your digital twin/i);
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: 'Why is my stress score high?' } });
    fireEvent.submit(form);

    expect(screen.getByText('Why is my stress score high?')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.chatWithAssistant).toHaveBeenCalledWith('Why is my stress score high?', 'default');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/the composite stress index \(csi\) measures/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/authenticated baseline engine/i)).toBeInTheDocument();
      expect(screen.getByText(/anxietytwin clinical architecture/i)).toBeInTheDocument();
    });
  });

  it('sends prompt chip suggestion directly when clicked', async () => {
    render(
      <BrowserRouter>
        <AIAssistantDrawer />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /ai clinical assistant/i }));

    const chip = await screen.findByText(/why is my stress score elevated\?/i);
    fireEvent.click(chip);

    await waitFor(() => {
      expect(api.chatWithAssistant).toHaveBeenCalledWith(
        'Why is my stress score elevated?',
        'default'
      );
    });
  });

  it('clears chat history when trash button is clicked', async () => {
    render(
      <BrowserRouter>
        <AIAssistantDrawer />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /ai clinical assistant/i }));

    // Send a message
    const input = screen.getByPlaceholderText(/ask about your digital twin/i);
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    // Clear history
    const clearBtn = screen.getByTitle(/clear conversation/i);
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(api.clearAssistantHistory).toHaveBeenCalledWith('default');
      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    });
  });
});
