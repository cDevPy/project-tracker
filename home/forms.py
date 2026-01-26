# home/forms.py
from django import forms
from tasks.models import Task
from projects.models import Project
from django.contrib.auth.models import User
from django.db import models

class TaskForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = ['title', 'description', 'project', 'assigned_to', 'status', 'priority', 'due_date']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Enter task title'}),
            'description': forms.Textarea(attrs={'class': 'form-textarea', 'rows': 4, 'placeholder': 'Enter task description...'}),
            'due_date': forms.DateInput(attrs={'type': 'date', 'class': 'form-input'}),
            'project': forms.Select(attrs={'class': 'form-select'}),
            'assigned_to': forms.Select(attrs={'class': 'form-select'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
            'priority': forms.Select(attrs={'class': 'form-select'}),
        }
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        
        if user:
            # Filter projects to only those the user has access to
            self.fields['project'].queryset = Project.objects.filter(
                models.Q(owner=user) | models.Q(members=user)
            ).distinct()

            # Initialize with empty queryset for assigned_to
            self.fields['assigned_to'].queryset = User.objects.none()
            
            # Add a custom attribute to store the filtered users
            self.fields['assigned_to'].widget.attrs['data-project-users'] = '[]'

            # If a project is already selected, filter users
            if self.instance and self.instance.project:
                self.fields['assigned_to'].queryset = self.instance.project.members.all()
            elif 'initial' in kwargs and 'project' in kwargs['initial']:
                project_id = kwargs['initial']['project']
                try:
                    project = Project.objects.get(id=project_id)
                    self.fields['assigned_to'].queryset = project.members.all()
                except Project.DoesNotExist:
                    pass

            self.fields['status'].choices = [
                ('todo', 'To Do'),
                ('inprogress', 'In Progress'),
                ('review', 'Review'),
                ('done', 'Done'),
            ]
            
            # Filter assignable users to team members in those projects
            project_ids = self.fields['project'].queryset.values_list('id', flat=True)
            self.fields['assigned_to'].queryset = User.objects.filter(
                models.Q(project_owner__id__in=project_ids) | 
                models.Q(project_member__id__in=project_ids)
            ).distinct()

class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['name', 'description', 'members']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4}),
            'members': forms.SelectMultiple(attrs={'class': 'form-control'}),
        }

class InviteForm(forms.Form):
    email = forms.EmailField()
    project = forms.ModelChoiceField(queryset=Project.objects.none())
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super(InviteForm, self).__init__(*args, **kwargs)
        
        if user:
            # Only show projects that the user owns
            self.fields['project'].queryset = Project.objects.filter(owner=user)