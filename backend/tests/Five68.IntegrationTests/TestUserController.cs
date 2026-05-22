using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Five68.Models;
using Five68.Models.Authentication;
using Five68.Models.DTO;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace Five68.IntegrationTests;

[Collection("Integration")]
public class TestUserController
{
    private readonly HttpClient client_;
    private readonly Five68WebAppFactory factory_;

    private const string AdminEmail = "admin@five68.com";
    private const string ManagerEmail = "manager@five68.com";
    private const string EmployeeEmail = "employee@five68.com";
    private const string Password = "ValidP@ss1!";

    public TestUserController(Five68WebAppFactory factory)
    {
        factory_ = factory;
        client_ = factory.CreateClient();
        SeedUser(AdminEmail, Password, UserRole.Admin);
        SeedUser(ManagerEmail, Password, UserRole.Manager);
        SeedUser(EmployeeEmail, Password, UserRole.Employee);
    }

    private void SeedUser(string email, string password, UserRole role)
    {
        using var scope = factory_.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();

        if (db.Users.Any(u => u.Email == email))
            return;

        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 4),
            FullName = "Test User",
            Role = role,
            Status = UserStatus.Active,
        });
        db.SaveChanges();
    }

    // --- GET /user ---

    [Fact]
    public async Task GetUsers_Authenticated_Returns200WithList()
    {
        await AuthorizeAsAsync(AdminEmail);
        var response = await client_.GetAsync("/user");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var users = await response.Content.ReadFromJsonAsync<List<UserDTO>>();
        users.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetUsers_Unauthenticated_Returns401()
    {
        client_.DefaultRequestHeaders.Authorization = null;
        var response = await client_.GetAsync("/user");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // --- GET /user/{id} ---

    [Fact]
    public async Task GetUserById_ExistingId_Returns200WithUser()
    {
        await AuthorizeAsAsync(AdminEmail);
        Guid id = GetUserId(AdminEmail);

        var response = await client_.GetAsync($"/user/{id}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var user = await response.Content.ReadFromJsonAsync<UserDTO>();
        user!.Email.Should().Be(AdminEmail);
    }

    [Fact]
    public async Task GetUserById_UnknownId_Returns404()
    {
        await AuthorizeAsAsync(AdminEmail);
        var response = await client_.GetAsync($"/user/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetUserById_Unauthenticated_Returns401()
    {
        client_.DefaultRequestHeaders.Authorization = null;
        var response = await client_.GetAsync($"/user/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // --- POST /user/signup ---

    [Fact]
    public async Task Signup_AdminCreatesManager_Returns201()
    {
        await AuthorizeAsAsync(AdminEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new UserRegister
        {
            Email = "new.manager@five68.com",
            FullName = "New Manager",
            Password = Password,
            Role = UserRole.Manager,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Signup_AdminCreatesEmployee_Returns201()
    {
        await AuthorizeAsAsync(AdminEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new UserRegister
        {
            Email = "new.employee@five68.com",
            FullName = "New Employee",
            Password = Password,
            Role = UserRole.Employee,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Signup_ManagerCreatesEmployee_Returns201()
    {
        await AuthorizeAsAsync(ManagerEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new UserRegister
        {
            Email = "another.employee@five68.com",
            FullName = "Another Employee",
            Password = Password,
            Role = UserRole.Employee,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Signup_AdminCreatesAdmin_Returns403()
    {
        await AuthorizeAsAsync(AdminEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new UserRegister
        {
            Email = "another.admin@five68.com",
            FullName = "Another Admin",
            Password = Password,
            Role = UserRole.Admin,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Signup_ManagerCreatesManager_Returns403()
    {
        await AuthorizeAsAsync(ManagerEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new UserRegister
        {
            Email = "another.manager2@five68.com",
            FullName = "Another Manager",
            Password = Password,
            Role = UserRole.Manager,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Signup_EmployeeCreatesEmployee_Returns403()
    {
        await AuthorizeAsAsync(EmployeeEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new UserRegister
        {
            Email = "yet.another@five68.com",
            FullName = "Yet Another",
            Password = Password,
            Role = UserRole.Employee,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Signup_DuplicateEmail_Returns422()
    {
        await AuthorizeAsAsync(AdminEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new UserRegister
        {
            Email = EmployeeEmail,
            FullName = "Duplicate",
            Password = Password,
            Role = UserRole.Employee,
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Signup_Unauthenticated_Returns401()
    {
        client_.DefaultRequestHeaders.Authorization = null;
        var response = await client_.PostAsJsonAsync("/user/signup", new UserRegister
        {
            Email = "noauth@five68.com",
            FullName = "No Auth",
            Password = Password,
            Role = UserRole.Employee,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Signup_MissingEmail_Returns400()
    {
        await AuthorizeAsAsync(AdminEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new
        {
            FullName = "No Email",
            Password = Password,
            Role = UserRole.Employee,
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Signup_MissingPassword_Returns400()
    {
        await AuthorizeAsAsync(AdminEmail);
        var response = await client_.PostAsJsonAsync("/user/signup", new
        {
            Email = "nopassword@five68.com",
            FullName = "No Password",
            Role = UserRole.Employee,
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // --- POST /user/{id}/invite ---

    [Fact]
    public async Task Invite_AdminInvitesEmployee_Returns200WithToken()
    {
        await AuthorizeAsAsync(AdminEmail);
        Guid id = GetUserId(EmployeeEmail);

        var response = await client_.PostAsync($"/user/{id}/invite", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        body!["inviteToken"].Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Invite_AdminInvitesEmployee_SetsStatusToPending()
    {
        await AuthorizeAsAsync(AdminEmail);
        Guid id = GetUserId(EmployeeEmail);

        await client_.PostAsync($"/user/{id}/invite", null);

        using var scope = factory_.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();
        db.Users.First(u => u.Id == id).Status.Should().Be(UserStatus.Pending);
    }

    [Fact]
    public async Task Invite_EmployeeInvites_Returns403()
    {
        await AuthorizeAsAsync(EmployeeEmail);
        Guid id = GetUserId(AdminEmail);

        var response = await client_.PostAsync($"/user/{id}/invite", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Invite_UnknownUser_Returns404()
    {
        await AuthorizeAsAsync(AdminEmail);

        var response = await client_.PostAsync($"/user/{Guid.NewGuid()}/invite", null);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Invite_Unauthenticated_Returns401()
    {
        client_.DefaultRequestHeaders.Authorization = null;
        Guid id = GetUserId(EmployeeEmail);

        var response = await client_.PostAsync($"/user/{id}/invite", null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // --- POST /user/invite/accept ---

    [Fact]
    public async Task AcceptInvite_ValidToken_Returns200()
    {
        string token = await GenerateInviteForAsync(EmployeeEmail);

        var response = await client_.PostAsJsonAsync("/user/invite/accept", new InviteAccept
        {
            Token = token,
            Password = "NewP@ss1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AcceptInvite_ValidToken_SetsStatusToActive()
    {
        string token = await GenerateInviteForAsync(EmployeeEmail);
        Guid id = GetUserId(EmployeeEmail);

        await client_.PostAsJsonAsync("/user/invite/accept", new InviteAccept
        {
            Token = token,
            Password = "NewP@ss1!"
        });

        using var scope = factory_.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();
        db.Users.First(u => u.Id == id).Status.Should().Be(UserStatus.Active);
    }

    [Fact]
    public async Task AcceptInvite_ValidToken_ClearsInviteToken()
    {
        string token = await GenerateInviteForAsync(EmployeeEmail);
        Guid id = GetUserId(EmployeeEmail);

        await client_.PostAsJsonAsync("/user/invite/accept", new InviteAccept
        {
            Token = token,
            Password = "NewP@ss1!"
        });

        using var scope = factory_.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();
        var user = db.Users.First(u => u.Id == id);
        user.InviteToken.Should().BeNull();
        user.InviteTokenExpiry.Should().BeNull();
    }

    [Fact]
    public async Task AcceptInvite_InvalidToken_Returns401()
    {
        var response = await client_.PostAsJsonAsync("/user/invite/accept", new InviteAccept
        {
            Token = "not-a-valid-token",
            Password = "NewP@ss1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AcceptInvite_ExpiredToken_Returns401()
    {
        string token = await GenerateInviteForAsync(EmployeeEmail);
        Guid id = GetUserId(EmployeeEmail);

        using (var scope = factory_.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();
            var user = db.Users.First(u => u.Id == id);
            user.InviteTokenExpiry = DateTimeOffset.UtcNow.AddDays(-1);
            db.SaveChanges();
        }

        var response = await client_.PostAsJsonAsync("/user/invite/accept", new InviteAccept
        {
            Token = token,
            Password = "NewP@ss1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AcceptInvite_TokenUsedTwice_Returns401()
    {
        string token = await GenerateInviteForAsync(EmployeeEmail);

        await client_.PostAsJsonAsync("/user/invite/accept", new InviteAccept
        {
            Token = token,
            Password = "NewP@ss1!"
        });

        var replayResponse = await client_.PostAsJsonAsync("/user/invite/accept", new InviteAccept
        {
            Token = token,
            Password = "AnotherP@ss1!"
        });

        replayResponse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AcceptInvite_MissingToken_Returns400()
    {
        var response = await client_.PostAsJsonAsync("/user/invite/accept", new
        {
            Password = "NewP@ss1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AcceptInvite_MissingPassword_Returns400()
    {
        string token = await GenerateInviteForAsync(EmployeeEmail);

        var response = await client_.PostAsJsonAsync("/user/invite/accept", new
        {
            Token = token
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task<string> GenerateInviteForAsync(string email)
    {
        await AuthorizeAsAsync(AdminEmail);
        Guid id = GetUserId(email);
        var response = await client_.PostAsync($"/user/{id}/invite", null);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["inviteToken"];
    }

    private async Task AuthorizeAsAsync(string email)
    {
        var response = await client_.PostAsJsonAsync("/auth/login", new UserLogin
        {
            Email = email,
            Password = Password,
        });
        var tokens = await response.Content.ReadFromJsonAsync<Tokens>();
        client_.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens!.AccessToken);
    }

    private Guid GetUserId(string email)
    {
        using var scope = factory_.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();
        return db.Users.First(u => u.Email == email).Id;
    }
}
