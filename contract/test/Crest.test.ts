import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Crest Protocol", function () {
    let crestEvents: any;
    let crestCore: any;
    let mockEAS: any;
    let owner: any;
    let organizer: any;
    let user1: any;
    let schemaUid: string;

    beforeEach(async function () {
        [owner, organizer, user1] = await ethers.getSigners();

        // Deploy Mock EAS
        const MockEAS = await ethers.getContractFactory("MockEAS");
        mockEAS = await MockEAS.deploy();
        await mockEAS.waitForDeployment();

        // Deploy CrestEvents
        const CrestEvents = await ethers.getContractFactory("CrestEvents");
        crestEvents = await CrestEvents.deploy();
        await crestEvents.waitForDeployment();

        // Deploy CrestCore
        schemaUid = ethers.keccak256(ethers.toUtf8Bytes("CrestAttendanceSchema"));
        const CrestCore = await ethers.getContractFactory("CrestCore");
        crestCore = await CrestCore.deploy(mockEAS.target, crestEvents.target, schemaUid);
        await crestCore.waitForDeployment();
    });

    describe("CrestEvents Primitive", function () {
        it("Should register an event correctly", async function () {
            const startTime = (await time.latest()) + 60; // 1 min from now
            const endTime = startTime + 3600; // 1 hour duration
            const ipfsHash = "ipfs://QmTz...";

            await expect(crestEvents.connect(organizer).registerEvent(startTime, endTime, ipfsHash))
                .to.emit(crestEvents, "EventRegistered")
                .withArgs(1, organizer.address, startTime, endTime, ipfsHash);

            const eventData = await crestEvents.events(1);
            expect(eventData.startTime).to.equal(startTime);
            expect(eventData.endTime).to.equal(endTime);
            expect(eventData.organizer).to.equal(organizer.address);
            expect(eventData.ipfsHash).to.equal(ipfsHash);
        });

        it("Should fail if start time is past end time", async function () {
            const startTime = (await time.latest()) + 3600;
            const endTime = startTime - 60;

            await expect(crestEvents.connect(organizer).registerEvent(startTime, endTime, "hash"))
                .to.be.revertedWithCustomError(crestEvents, "InvalidTimeWindow");
        });
    });

    describe("CrestCore State Machine and Cooldowns", function () {
        let eventId1: number = 1;
        let eventId2: number = 2;
        let eventId3: number = 3;
        let eventId4: number = 4;

        beforeEach(async function () {
            const now = await time.latest();
            const startTime = now + 60;
            // Register multiple ongoing/future events
            // eventId 1: active immediately for a long time
            await crestEvents.connect(organizer).registerEvent(startTime, startTime + 1000000, "hash1");
            // eventId 2,3,4
            await crestEvents.connect(organizer).registerEvent(startTime, startTime + 1000000, "hash2");
            await crestEvents.connect(organizer).registerEvent(startTime, startTime + 1000000, "hash3");
            await crestEvents.connect(organizer).registerEvent(startTime, startTime + 1000000, "hash4");
            // fast forward to start time
            await time.increaseTo(startTime);
        });

        it("Dormant user should claim and become Active (Tier 1)", async function () {
            expect(await crestCore.userTiers(user1.address)).to.equal(0); // Dormant

            const tx = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1");

            await expect(tx).to.emit(crestCore, "TierUpgraded")
                .withArgs(user1.address, 0, 1);

            expect(await crestCore.userTiers(user1.address)).to.equal(1); // Active
        });

        it("Active user should hit 1 hour cooldown", async function () {
            // First claim -> Becomes active
            await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1");

            // Attempt second claim immediately on different event
            await expect(crestCore.connect(user1).claimAttendance(eventId2, 0, "hash2"))
                .to.be.revertedWithCustomError(crestCore, "CooldownActive");

            // Fast forward 1 hour
            await time.increase(3600); // 1 hour

            // Successful claim
            await expect(crestCore.connect(user1).claimAttendance(eventId2, 0, "hash2"))
                .to.not.be.reverted;
        });

        it("Active user should become Ascended after 10 attendances", async function () {
            // We need 10 distinct events to do 10 attendances. 
            // We'll create another 6 events quickly inside this test just for this
            const now = await time.latest();
            const futureStart = now + 60;
            for (let i = 5; i <= 10; i++) {
                await crestEvents.connect(organizer).registerEvent(futureStart, futureStart + 1000000, "hash_extra");
            }
            await time.increaseTo(futureStart); // Advance to start time

            let currentEventId = 1;

            // Do 9 attendances
            for (let i = 0; i < 9; i++) {
                await crestCore.connect(user1).claimAttendance(currentEventId++, 0, "hashx");
                await time.increase(3600); // Wait 1 hour between claims
            }

            expect(await crestCore.userTiers(user1.address)).to.equal(1); // Still Active

            // 10th Attendance -> Upgrade to Ascended
            const tx10 = await crestCore.connect(user1).claimAttendance(currentEventId, 0, "hashx");

            await expect(tx10).to.emit(crestCore, "TierUpgraded")
                .withArgs(user1.address, 1, 2);

            expect(await crestCore.userTiers(user1.address)).to.equal(2); // Ascended
        });

        it("Active user should decay to Dormant after 30 days of inactivity", async function () {
            // Claim once to become Active
            await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1");
            expect(await crestCore.userTiers(user1.address)).to.equal(1); // Active

            // Fast forward 31 days
            await time.increase(31 * 24 * 60 * 60);

            // Our original events from the beforeEach block expired after 11.5 days (1,000,000 seconds)
            // We need to create a brand new active event to claim attendance for this final part of the test
            const newNow = await time.latest();
            const newStart = newNow + 60;
            await crestEvents.connect(organizer).registerEvent(newStart, newStart + 1000000, "hash_new");
            await time.increaseTo(newStart); // Advance to start time

            // They try to claim attendance on this newly registered event (which will have ID 5)
            const tx = await crestCore.connect(user1).claimAttendance(5, 0, "hash_new");

            // The claim triggers the decay process, dropping them to Dormant, then processing the claim to make them Active again
            await expect(tx).to.emit(crestCore, "TierDowngraded").withArgs(user1.address, 1, 0); // Decayed
            // After being downgraded to Dormant, the claim immediately makes them Active again
            await expect(tx).to.emit(crestCore, "TierUpgraded").withArgs(user1.address, 0, 1);

            // Their tier is now Active, but their attendanceCount was reset to 1
            expect(await crestCore.attendanceCount(user1.address)).to.equal(1);
        });

        it("Should prevent dual claim for the same event", async function () {
            await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1");

            // even if time passes, cannot claim same event
            await time.increase(3600);

            await expect(crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1"))
                .to.be.revertedWithCustomError(crestCore, "AlreadyAttendedEvent");
        });

        describe("Revocation", function () {
            it("Should allow the organizer to revoke an attendance", async function () {
                // User claims attendance
                const tx = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1");
                const receipt = await tx.wait();

                // Extract attestationUid from the AttendanceClaimed event
                const claimedEvent = receipt?.logs.find(
                    (log: any) => log.fragment && log.fragment.name === "AttendanceClaimed"
                );
                const uid = claimedEvent?.args?.attestationUid;

                // Organizer revokes it
                await expect(crestCore.connect(organizer).revokeAttendance(eventId1, uid))
                    .to.emit(crestCore, "AttendanceRevoked")
                    .withArgs(organizer.address, eventId1, uid)
                    .and.to.emit(mockEAS, "Revoked")
                    .withArgs(uid, schemaUid);
            });

            it("Should not allow a non-organizer to revoke an attendance", async function () {
                // User claims attendance
                const tx = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1");
                const receipt = await tx.wait();

                const claimedEvent = receipt?.logs.find(
                    (log: any) => log.fragment && log.fragment.name === "AttendanceClaimed"
                );
                const uid = claimedEvent?.args?.attestationUid;

                // user1 tries to revoke their own attendance or a random user tries
                await expect(crestCore.connect(user1).revokeAttendance(eventId1, uid))
                    .to.be.revertedWithCustomError(crestCore, "NotEventOrganizer");
            });
        });
    });
});
