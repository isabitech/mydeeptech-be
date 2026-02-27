const domainToUserService = require("../services/domain-to-user.service");
const ResponseClass = require("../utils/response-handler");

class DomainToUserController {
    static async assignDomainToUser(req, res) {
        const { domainIds } = req.body;
        const userId = req.user ? req.user.userId : undefined;
        const assignment = await domainToUserService.assignMultipleDomainsToUser(userId, domainIds);
        return ResponseClass.Success(res, { message: "Domains assigned to user successfully", data: assignment });
    }

    static async fetchDomainsForUser(req, res) {
        const { userId } = req.user;
        const result = await domainToUserService.fetchDomainToUserById(userId);
        return ResponseClass.Success(res, { message: "Domains for user retrieved successfully", data: result });
    }

    static async removeDomainFromUser(req, res) {
        const id = req.params.id;
        await domainToUserService.removeDomainfromUser(id);
        return ResponseClass.Success(res, { message: "Domain removed from user successfully" });
    }
    static async getAllDomainToUser(req, res) {
        const result = await domainToUserService.fetchAllDomainToUser();
        return ResponseClass.Success(res, { message: "Domain to user mappings retrieved successfully", data: result });
    }
}

module.exports = DomainToUserController;