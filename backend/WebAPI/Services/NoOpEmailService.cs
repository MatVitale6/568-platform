namespace Five68.Services
{
    public class NoOpEmailService : IEmailService
    {
        private readonly ILogger<NoOpEmailService> logger_;

        public NoOpEmailService(ILogger<NoOpEmailService> logger)
        {
            logger_ = logger;
        }

        public Task SendInviteAsync(string toEmail, string inviteLink)
        {
            logger_.LogInformation("Invite for {Email} — link: {Link}", toEmail, inviteLink);
            return Task.CompletedTask;
        }
    }
}
