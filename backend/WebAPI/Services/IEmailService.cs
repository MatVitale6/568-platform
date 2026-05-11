namespace Five68.Services
{
    public interface IEmailService
    {
        Task SendInviteAsync(string toEmail, string inviteLink);
    }
}
