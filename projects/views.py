from django.shortcuts import render
from django.shortcuts import get_object_or_404, redirect, render
from django.contrib import messages
from .models import Project, ProjectMember
#from .forms import AddProjectMemberForm
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from notifications.models import Notification
from django.core.mail import send_mail
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.contrib import messages
from django.utils.http import urlencode
from .models import Invitation, Project  # adjust imports
from django.conf import settings
from .models import Invitation






#SENDING PROJECT  INVITATION



User = get_user_model()






@login_required
def send_project_invite(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    email = request.POST.get('email', '').strip()
    role = request.POST.get('role', 'Member')

    if request.user != project.owner:
        Notification.objects.create(
            user=request.user,
            type='system',
            message="Only the project owner can invite new members.",
            is_read=False
        )
        request.session['play_notification_sound'] = True
        return redirect('home.dashboard')

    if email.lower() == request.user.email.lower():
        Notification.objects.create(
            user=request.user,
            type='system',
            message="You cannot invite yourself to a project.",
            is_read=False
        )
        request.session['play_notification_sound'] = True
        return redirect('home.dashboard')


    # Prevent duplicate pending invites to same email for same project
    existing = Invitation.objects.filter(
        project=project, email__iexact=email, status='pending'
    ).first()
    if existing and not existing.is_expired():
        Notification.objects.create(
            user=request.user,
            type='system',
            message=f"An invitation has already been sent to {email}.",
            is_read=False
        )
        request.session['play_notification_sound'] = True
        return redirect('home.dashboard')

    # Create invitation
    invitation = Invitation.objects.create(
        project=project,
        email=email,
        role=role,
        invited_by=request.user,
    )

    # Build accept URL
    accept_url = request.build_absolute_uri(
        reverse('projects:accept_invitation', kwargs={'token': invitation.token})
    )

    # Send email
    context = {
        'project_name': project.name,
        'inviter_name': request.user.get_full_name() or request.user.username,
        'role': role,
        'accept_url': accept_url,
    }
    subject = f"You've been invited to join {project.name} on SwyftTask"
    html_message = render_to_string('project_invitation.html', context)
    email_msg = EmailMultiAlternatives(subject, "", None, [email])
    email_msg.attach_alternative(html_message, "text/html")
    try:
        email_msg.send(fail_silently=False)
    except Exception as e:
        print(f"❌ Email send failed: {e}")
    # Still create the notification even if email fails

    # Notify the OWNER that the invite was sent
    Notification.objects.create(
        user=request.user,
        type='system',
        related_invitation=invitation,
        related_project=project,
        message=f"Invitation sent to {email} for {project.name}.",
        is_read=False
    )

    request.session['play_notification_sound'] = True
    return redirect('home.dashboard')




#ACCEPTING PROJECT INVITATION
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.urls import reverse

from .models import Invitation, ProjectMember


def accept_invitation(request, token):
    """Handle Accept Invitation link from email"""

    invitation = get_object_or_404(Invitation, token=token)

    # Check validity
    if invitation.status != 'pending' or invitation.is_expired():
        messages.error(request, "This invitation has expired or is no longer valid.")
        return redirect('home.dashboard')

    # ====== CASE 1: User is already logged in ======
    if request.user.is_authenticated:

        # Warn if wrong account but still allow (Trello behaviour)
        if request.user.email.lower() != invitation.email.lower():
            messages.warning(
                request,
                f"Note: this invitation was sent to {invitation.email} "
                f"but you are logged in as {request.user.email}."
            )

        # Add to project
        ProjectMember.objects.update_or_create(
            project=invitation.project,
            user=request.user,
            defaults={'role': invitation.role}
        )
        invitation.project.members.add(request.user)

        invitation.status = 'accepted'
        invitation.save()

        # Notify the MEMBER they joined
        Notification.objects.create(
            user=request.user,
            type='project_join',
            related_project=invitation.project,
            related_invitation=invitation,
            message=f"You have successfully joined {invitation.project.name} as {invitation.role}!",
            is_read=False
        )

        # Notify the OWNER the invite was accepted
        Notification.objects.create(
            user=invitation.invited_by,
            type='invite_accepted',
            related_project=invitation.project,
            related_invitation=invitation,
            message=(
                f"{request.user.get_full_name() or request.user.username} "
                f"accepted your invitation and joined {invitation.project.name}!"
            ),
            is_read=False
        )

        # Store welcome message to show as toast on the project page
        request.session['welcome_project_id'] = invitation.project.id
        request.session['welcome_project_name'] = invitation.project.name
        request.session['welcome_role'] = invitation.role

        # Redirect straight to the project
        return redirect(
            f'/?project={invitation.project.id}'  # opens the project on the dashboard
        )

    # ====== CASE 2: User is NOT logged in ======
    # Save token in session to process after login/signup
    request.session['pending_invite_token'] = token

    user_exists = User.objects.filter(email__iexact=invitation.email).exists()

    if user_exists:
        login_url = '/accounts/login/'
        next_url = f'/invites/accept/{token}/'
        return redirect(f"{login_url}?next={next_url}")
    else:
        signup_url = f"/accounts/signup/?invite_token={token}"
        return redirect(signup_url)    




#EMAIL VERIFICATION FOR PROJECT INVITATION

def verify_invite(request, token):
    invitation = get_object_or_404(Invitation, token=token)

    if invitation.is_expired():
        invitation.status = 'expired'
        invitation.save()
        messages.error(request, "Code expired.")
        return redirect("login")

    if request.method == "POST":
        code = request.POST.get("code")

        if code == invitation.verification_code:

            if not request.user.is_authenticated:
                messages.error(request, "Please login first.")
                return redirect("login")

            # Add member
            ProjectMember.objects.create(
                user=request.user,
                project=invitation.project,
                role='member'
            )

            invitation.status = 'completed'
            invitation.save()

            # Notify Owner
            Notification.objects.create(
                user=invitation.invited_by,
                message=f"{request.user.username} joined {invitation.project.name}"
            )

            messages.success(request, "Successfully joined project!")
            return redirect("invite_member.html")

        else:
            messages.error(request, "Invalid verification code.")

    return render(request, "verify_code.html", {"token": token})





@login_required
def update_member_role(request, member_id):
    member = get_object_or_404(ProjectMember, id=member_id)
    project = member.project

    # Only owner can assign roles
    if request.user != project.owner:
        messages.error(request, "You are not authorized to change roles.")
        return redirect("project_detail", project_id=project.id)

    if request.method == "POST":
        new_role = request.POST.get("role")
        if new_role not in dict(ProjectMember.ROLE_CHOICES):
            messages.error(request, "Invalid role.")
            return redirect("project_detail", project_id=project.id)

        member.role = new_role
        member.save()
        messages.success(request, f"{member.user.username} role updated to {new_role}.")

    return redirect("project_detail", project_id=project.id)