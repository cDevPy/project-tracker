from django.shortcuts import render, redirect
# from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate, logout
from .forms import CustomUserCreationForm, CustomErrorList
from django.contrib import messages
from django.core.mail import EmailMessage
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.models import User
from .forms import CustomUserCreationForm
from .models import CustomUser
from . models import PasswordResetPIN
from django.contrib.sessions.backends.db import SessionStore
from django.http import JsonResponse
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.template.loader import render_to_string
from django.conf import settings
from datetime import timedelta
import logging
import random


User = get_user_model()
logger = logging.getLogger(__name__)





# Create your views here.

def access(request):
    template_data = {}
    template_data['title'] = 'Account Access | SwyftTask'
    return render(request, 'accounts/access.html', {'template_data': template_data})

def signup(request):
    template_data = {}
    template_data['title'] = 'Sign Up | Project Tracker'

    if request.method == "GET":
        template_data['form'] = CustomUserCreationForm()
        return render(request, "accounts/signup.html", {'template_data': template_data})

    elif request.method == "POST":
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.is_active = False  # require email activation
            user.save()

            request.session['activation_email'] = user.email

            # Generate email activation link
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            activation_link = request.build_absolute_uri(f"/accounts/activate/{uid}/{token}/")

            # Email message
            message = f"""
Hello {user.username},

Welcome to SwyftTask!

Please click the link below to activate your account:

{activation_link}

If you didn’t create this account, ignore this message.
"""

            # Send email using project name
            email = EmailMessage(
                "Activate Your SwyftTask Account",
                message,
                "SwyftTask <noreply@swyfttask.com>",
                [user.email],
            )
            email.send()

            messages.success(request, "Your account was created. Check your email to activate it.")
            return redirect("accounts.check_email")

        template_data['form'] = form
        return render(request, "accounts/signup.html", {'template_data': template_data})
    

def activate_account(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = CustomUser.objects.get(pk=uid)
    except:
        user = None

    if user and default_token_generator.check_token(user, token):
        user.is_active = True
        user.save()
        messages.success(request, "Your account has been activated successfully.")
        return redirect("activation.success")

    messages.error(request, "Activation link is invalid or has expired.")
    return redirect("accounts.signup")    


def check_email(request):
    email = request.session.get('activation_email','')
    return render(request, "accounts/check_email.html",{'email':email})


def activation_success(request):
    return render(request, "accounts/successful_activation.html")



User = get_user_model()

PIN_EXPIRY_MINUTES = 10  # PIN valid for 10 minutes

# 1️⃣ Password reset request: send PIN to email


def password_reset_request(request):
    template_data = {
        'title': 'Reset Password | SwyftTask'
    }

    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()

        if not email:
            template_data['error'] = "Please enter an email address."
            return render(request, "accounts/password_reset_request.html", {'template_data': template_data})

        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            # Show error and re-render the form (so user sees it immediately)
            template_data['error'] = "No account found with that email address."
            return render(request, "accounts/password_reset_request.html", {'template_data': template_data})

        # Generate 4-digit PIN
        pin = str(random.randint(1000, 9999))
        PasswordResetPIN.objects.create(user=user, pin=pin)

        # Send PIN via email
        subject = "Your Password Reset PIN"
        message = f"Your 4-digit PIN is {pin}. It expires in {getattr(settings, 'PIN_EXPIRY_MINUTES', 10)} minutes."
        send_mail(
            subject,
            message,
            "noreply@yourapp.com",
            [email],
            fail_silently=False,
        )

        # Save email in session for verification step
        request.session['reset_email'] = email
        request.session.modified = True

        messages.success(request, "A 4-digit PIN has been sent to your email.")
        return redirect("password_reset_verify")

    # GET request - just show the form
    return render(request, "accounts/password_reset_request.html", {'template_data': template_data})


# 2️⃣ Verify PIN
from django.shortcuts import render, redirect
from django.utils import timezone

def password_reset_verify(request):
    email = request.session.get('reset_email')
    error = None

    if request.method == "POST":
        pin = (
            request.POST.get("d1", "") +
            request.POST.get("d2", "") +
            request.POST.get("d3", "") +
            request.POST.get("d4", "")
        )

        # Fallback if session expired
        if not email:
            email = request.POST.get('email')
            if not email:
                return redirect("password_reset_request")
            request.session['reset_email'] = email

        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return redirect("password_reset_request")

        try:
            reset_pin = PasswordResetPIN.objects.filter(
                user=user,
                pin=pin
            ).latest('created_at')
        except PasswordResetPIN.DoesNotExist:
            error = "Invalid PIN. You can request a new one by clicking the resend button."
            return render(
                request,
                "accounts/password_reset_verify.html",
                {"email": email, "error": error}
            )

        if reset_pin.is_expired():
            reset_pin.delete()
            error = "Invalid PIN. You can request a new one by clicking the resend button."
            return render(
                request,
                "accounts/password_reset_verify.html",
                {"email": email, "error": error}
            )

        # ✅ PIN valid
        request.session['reset_user_id'] = user.id
        reset_pin.delete()
        return redirect("password_reset_form")

    return render(request, "accounts/password_reset_verify.html", {"email": email})


# 3️⃣ Password reset form
def password_reset_form(request):
    user_id = request.session.get('reset_user_id')
    if not user_id:
        messages.error(request, "Session expired. Please start again.")
        return redirect("password_reset_request")

    user = User.objects.get(id=user_id)

    if request.method == "POST":
        password1 = request.POST.get("password1")
        password2 = request.POST.get("password2")
        if not password1 or not password2:
            messages.error(request, "Please enter both password fields.")
            return redirect("password_reset_form")

        if password1 != password2:
            messages.error(request, "Passwords do not match.")
            return redirect("password_reset_form")

        user.set_password(password1)
        user.save()

        # Clear session
        request.session.pop('reset_user_id', None)
        request.session.pop('reset_email', None)

        messages.success(request, "Your password has been reset successfully.")
        return redirect("accounts.login")

    return render(request, "accounts/password_reset_form.html")




def userLogin(request):
    template_data = {
        'title': 'Login | SwyftTask'
    }

    if request.method == 'GET':
        return render(request, 'accounts/login.html', {'template_data': template_data})

    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        user = authenticate(
            request,
            username=email,   # maps to USERNAME_FIELD = "email"
            password=password
        )

        if user is None:
            template_data['error'] = 'Invalid email or password.'
            return render(request, 'accounts/login.html', {'template_data': template_data})

        if not user.is_active:
            template_data['error'] = 'Your account is not activated. Check your email.'
            return render(request, 'accounts/login.html', {'template_data': template_data})

        login(request, user)
        return redirect('home.dashboard')

def userLogout(request):
    logout(request)
    return redirect('home.landing')


@csrf_exempt
def resend_activation_email(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Invalid method'}, status=400)

    email = request.POST.get('email')
    if not email:
        return JsonResponse({'success': False, 'message': 'Email missing'}, status=400)

    try:
        user = User.objects.get(email=email)  # Removed is_active=False
    except User.DoesNotExist:
        return JsonResponse({'success': True, 'message': 'If your email is registered, a new link has been sent.'})

    if user.is_active:
        return JsonResponse({'success': True, 'message': 'Your account is already activated. You can log in.'})

    # Generate new link
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    activation_link = request.build_absolute_uri(
        reverse('accounts.activate', args=[uid, token])
    )

    message = render_to_string('activation_email.txt', {
        'user': user,
        'activation_link': activation_link,
    })

    email_msg = EmailMessage(
        subject="Resend: Activate Your SwyftTask Account",
        body=message,
        from_email="SwyftTask <noreply@swyfttask.com>",
        to=[user.email],
    )

    try:
        email_msg.send(fail_silently=False)
        logger.info(f"Activation email resent to {user.email}")
        return JsonResponse({'success': True, 'message': 'New activation link sent! Check your email.'})
    except Exception as e:
        logger.error(f"Failed to resend: {e}")
        return JsonResponse({'success': False, 'message': 'Failed to send email. Try again later.'}, status=500)