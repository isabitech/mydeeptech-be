const domainToUserService = require("../services/domain-to-user.service");
const ResponseClass = require("../utils/response-handler");


class DomainToUserController {
    static async assignDomainToUser(req, res, next) {

        const { domainIds } = req.body;
        const userId = req.user ? req.user.userId : undefined;
        try {
            const assignment = await domainToUserService.assignMultipleDomainsToUser(userId, domainIds);
            return ResponseClass.Success(res, { message: "Domains assigned to user successfully", data: assignment });
        } catch (err) {
            next(err);
        }
    }

    static async fetchDomainsForUser(req, res, next) {
        try {
            const { userId } = req.user;
            const result = await domainToUserService.fetchDomainToUserById(userId);
            return ResponseClass.Success(res, { message: "Domains for user retrieved successfully", data: result });
        }
        catch (err) {
            next(err);
        }
    }

    static async removeDomainFromUser(req, res, next) {
        try {
            const id = req.params.id;
            await domainToUserService.removeDomainfromUser(id);
            return ResponseClass.Success(res, { message: "Domain removed from user successfully" });
        } catch (err) {
            next(err);
        }
    }
    static async getAllDomainToUser(req, res, next) {
        try {
            const result = await domainToUserService.fetchAllDomainToUser();
            return ResponseClass.Success(res, { message: "Domain to user mappings retrieved successfully", data: result });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = DomainToUserController;