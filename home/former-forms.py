

from django import forms
from projects.models import Project
from tasks.models import Task

class TaskForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = ['title', 'project', 'assigned_to', 'due_date', 'status']
        widgets = {
            'due_date': forms.DateInput(attrs={'type': 'date'}),
        }

class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['name', 'description']

class InviteForm(forms.Form):
    username = forms.CharField(label="Username to Invite", max_length=150)