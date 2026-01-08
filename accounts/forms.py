from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import CustomUser
from django.forms.utils import ErrorList
from django.utils.safestring import mark_safe

class CustomErrorList(ErrorList):
    def _str_(self):
        if not self:
            return ""
        return mark_safe("".join([
            f'<div class="alert alert-danger" role="alert">{e}</div>' for e in self
        ]))

class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = CustomUser
        fields = ["username", "email", "password1", "password2"]

    def _init_(self, *args, **kwargs):
        super()._init_(*args, **kwargs)
        for fieldname in ['username', 'email', 'password1', 'password2']:
            field = self.fields[fieldname]
            field.help_text = None
            field.widget.attrs.update({'class': 'form-control form-input'})
            field.label_suffix = ""
            field.label = mark_safe(f'<span class="form-label">{field.label}</span>')