from django import forms
from projects.models import Project



class InviteForm(forms.Form):
    email = forms.EmailField()
    project = forms.ModelChoiceField(queryset=Project.objects.none())
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super(InviteForm, self).__init__(*args, **kwargs)
        
        if user:
            # Only show projects that the user owns
            self.fields['project'].queryset = Project.objects.filter(owner=user)