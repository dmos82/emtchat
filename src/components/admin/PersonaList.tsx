'use client';

import React, { useState, useEffect } from 'react';
import { Persona } from '@/types';
import { getPersonas, activatePersona, deactivatePersona, deletePersona } from '@/lib/api/personas';
import { usePersona } from '@/contexts/PersonaContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CreatePersonaForm from './CreatePersonaForm';
import EditPersonaForm from './EditPersonaForm';

interface PersonaListProps {
  onCreateNew?: () => void;
  onEdit?: (persona: Persona) => void;
}

export default function PersonaList({ onCreateNew, onEdit }: PersonaListProps) {
  const { toast } = useToast();
  const {
    personas: contextPersonas,
    activePersona,
    isLoading: isPersonaContextLoading,
    error: personaContextError,
    refreshPersonas,
    setActivePersonaLocal,
  } = usePersona();

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    persona: Persona | null;
  }>({ isOpen: false, persona: null });

  // Create form state
  const [createFormOpen, setCreateFormOpen] = useState(false);

  // Edit form state
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  // Fetch personas on component mount
  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedPersonas = await getPersonas();
      setPersonas(fetchedPersonas);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load personas';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (persona: Persona) => {
    try {
      setActionLoading(persona._id);
      await activatePersona(persona._id);

      // Update local state
      setPersonas(prev =>
        prev.map(p => ({
          ...p,
          isActive: p._id === persona._id,
        }))
      );

      // Update context state
      setActivePersonaLocal(persona);

      toast({
        title: 'Success',
        description: `Activated persona "${persona.name}"`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to activate persona';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      // Refresh on error to ensure UI is in sync
      await refreshPersonas();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async () => {
    try {
      setActionLoading('deactivate');
      await deactivatePersona();

      // Update local state
      setPersonas(prev =>
        prev.map(p => ({
          ...p,
          isActive: false,
        }))
      );

      // Update context state
      setActivePersonaLocal(null);

      toast({
        title: 'Success',
        description: 'Deactivated current persona',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deactivate persona';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      // Refresh on error to ensure UI is in sync
      await refreshPersonas();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.persona) return;

    try {
      setActionLoading(deleteDialog.persona._id);
      const result = await deletePersona(deleteDialog.persona._id);

      // If the deleted persona was active, clear active state
      if (result.wasActive) {
        setActivePersonaLocal(null);
      }

      // Remove from local state
      setPersonas(prev => prev.filter(p => p._id !== deleteDialog.persona!._id));

      toast({
        title: 'Success',
        description: `Deleted persona "${deleteDialog.persona.name}"${result.wasActive ? ' (was active)' : ''}`,
      });

      setDeleteDialog({ isOpen: false, persona: null });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete persona';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteDialog = (persona: Persona) => {
    setDeleteDialog({ isOpen: true, persona });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({ isOpen: false, persona: null });
  };

  // Handle create persona
  const handleCreateNew = () => {
    // Use external handler if provided, otherwise use internal
    if (onCreateNew) {
      onCreateNew();
    } else {
      setCreateFormOpen(true);
    }
  };

  const handlePersonaCreated = async (_newPersona: Persona) => {
    setCreateFormOpen(false);
    await fetchPersonas(); // Refresh the list
  };

  const handleEditPersona = (persona: Persona) => {
    // Use external handler if provided, otherwise use internal
    if (onEdit) {
      onEdit(persona);
    } else {
      setEditingPersona(persona);
      setEditFormOpen(true);
    }
  };

  const handlePersonaUpdated = async (_updatedPersona: Persona) => {
    setEditFormOpen(false);
    setEditingPersona(null);
    await fetchPersonas(); // Refresh the list
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading personas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500 mb-4">Error: {error}</p>
        <Button onClick={fetchPersonas} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Persona Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage system personas that define AI behavior and responses.
          </p>
        </div>
        <Button onClick={handleCreateNew} className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Create Persona
        </Button>
      </div>

      {/* Active Persona Section */}
      {activePersona && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300 text-base sm:text-lg">
              <Power className="h-4 w-4 sm:h-5 sm:w-5" />
              Active Persona
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  {activePersona.name}
                </h3>
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-1">
                  Active persona for AI responses
                </p>
              </div>
              <Button
                onClick={handleDeactivate}
                variant="outline"
                size="sm"
                disabled={actionLoading === 'deactivate'}
                className="w-full sm:w-auto border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900"
              >
                {actionLoading === 'deactivate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
                <span className="ml-1">Deactivate</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personas List */}
      <div className="grid gap-3 sm:gap-4">
        {personas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No personas found.</p>
              <Button onClick={handleCreateNew} className="mt-4">
                Create your first persona
              </Button>
            </CardContent>
          </Card>
        ) : (
          personas.map(persona => (
            <Card key={persona._id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-3">
                  <div className="flex-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                      {persona.name}
                      {persona.isActive && (
                        <Badge
                          variant="default"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          Active
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Created: {new Date(persona.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!persona.isActive && (
                      <Button
                        onClick={() => handleActivate(persona)}
                        variant="outline"
                        size="sm"
                        disabled={actionLoading === persona._id}
                        className="flex-1 sm:flex-none min-w-[80px]"
                      >
                        {actionLoading === persona._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                        <span className="ml-1">Activate</span>
                      </Button>
                    )}
                    <Button
                      onClick={() => handleEditPersona(persona)}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none min-w-[60px]"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="ml-1">Edit</span>
                    </Button>
                    <Button
                      onClick={() => openDeleteDialog(persona)}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none min-w-[70px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="ml-1">Delete</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  <p className="line-clamp-2 sm:line-clamp-3">{persona.prompt}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Persona</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the persona "{deleteDialog.persona?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading === deleteDialog.persona?._id}
            >
              {actionLoading === deleteDialog.persona?._id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Persona Form */}
      {createFormOpen && (
        <CreatePersonaForm
          isOpen={createFormOpen}
          onClose={() => setCreateFormOpen(false)}
          onPersonaCreated={handlePersonaCreated}
        />
      )}

      {/* Edit Persona Form */}
      {editFormOpen && editingPersona && (
        <EditPersonaForm
          isOpen={editFormOpen}
          persona={editingPersona}
          onClose={() => {
            setEditFormOpen(false);
            setEditingPersona(null);
          }}
          onPersonaUpdated={handlePersonaUpdated}
        />
      )}
    </div>
  );
}
