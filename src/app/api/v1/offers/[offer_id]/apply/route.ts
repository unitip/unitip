import { verifyBearerToken } from "@/lib/bearer-token";
import { database } from "@/lib/database";
import { APIResponse } from "@/lib/models/api-response";
import { sql } from "kysely";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ApplicantStatus } from "@/constants/constants";

interface POSTResponse {
  success: boolean;
  id: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { offer_id: string } }
) {
  try {
    const json = await request.json();
    const {
      note,
      destination_location,
      pickup_location,
      pickup_latitude,
      pickup_longitude,
      destination_latitude,
      destination_longitude,
    } = json;
    const { offer_id } = params;

    const schema = z.object({
      note: z.string({
        required_error: "Catatan untuk pemesanan tidak boleh kosong!",
      }),
      destination_location: z.string({
        required_error: "Lokasi tujuan tidak boleh kosong!",
      }),
      pickup_location: z.string({
        required_error: "Lokasi penjemputan tidak boleh kosong!",
      }),
      pickup_latitude: z.number({
        required_error: "Latitude lokasi penjemputan tidak boleh kosong!",
      }),
      pickup_longitude: z.number({
        required_error: "Longitude lokasi penjemputan tidak boleh kosong!",
      }),
      destination_latitude: z.number({
        required_error: "Latitude lokasi tujuan tidak boleh kosong!",
      }),
      destination_longitude: z.number({
        required_error: "Longitude lokasi tujuan tidak boleh kosong!",
      }),
      offer_id: z.string().min(1, "Offer ID tidak boleh kosong!"),
    });

    const data = schema.safeParse({
      note,
      destination_location,
      pickup_location,
      pickup_latitude,
      pickup_longitude,
      destination_latitude,
      destination_longitude,
      offer_id,
    });

    if (!data.success) {
      return APIResponse.respondWithBadRequest(
        data.error.errors.map((it) => ({
          message: it.message,
          path: it.path[0] as string,
        }))
      );
    }

    const authorization = await verifyBearerToken(request);
    if (!authorization) return APIResponse.respondWithUnauthorized();

    // verifikasi role user
    if (authorization.role !== "customer") {
      return APIResponse.respondWithForbidden(
        "Anda tidak memiliki akses untuk melakukan aksi ini!"
      );
    }

    const singleOffer = await database
      .selectFrom("offers")
      .select(["id", "offer_status"])
      .where("id", "=", offer_id)
      .where("offer_status", "=", "available")
      .where("available_until", ">", sql<Date>`NOW()`)
      .executeTakeFirst();

    if (!singleOffer) {
      return APIResponse.respondWithConflict(
        "Offer tidak tersedia atau sudah berakhir!"
      );
    }

    const existingApplication = await database
      .selectFrom("offer_applicants")
      .select("id")
      .where("customer", "=", authorization.userId as any)
      .where("offer", "=", offer_id as any)
      .executeTakeFirst();

    if (existingApplication) {
      return APIResponse.respondWithConflict(
        "Anda sudah mengajukan aplikasi untuk offer ini!"
      );
    }

    const result = await database
      .insertInto("offer_applicants")
      .values({
        applicant_status: ApplicantStatus.PENDING,
        note,
        pickup_location,
        destination_location,
        pickup_latitude,
        pickup_longitude,
        destination_latitude,
        destination_longitude,
        customer: authorization.userId,
        offer: offer_id,
      } as any)
      .returning("id")
      .executeTakeFirst();

    if (!result) return APIResponse.respondWithServerError();

    await database
      .updateTable("offers")
      .set({
        offer_status: "on_progress",
      })
      .where("id", "=", offer_id)
      .execute();

    return APIResponse.respondWithSuccess<POSTResponse>({
      success: true,
      id: result.id,
    });
  } catch (e) {
    console.error(e);
    return APIResponse.respondWithServerError();
  }
}

interface DELETEResponse {
  success: Boolean;
  id: string;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { offer_id: string } }
) {
  try {
    // verifikasi request user
    const { offer_id: offerId } = params;
    const validate = z
      .object({
        offerId: z
          .string({ required_error: "ID penawaran tidak boleh kosong!" })
          .min(1, "ID penawaran tidak boleh kosong!"),
      })
      .safeParse({ offerId });
    if (!validate.success)
      return APIResponse.respondWithBadRequest(
        validate.error.errors.map((it) => ({
          path: it.path[0] as string,
          message: it.message,
        }))
      );

    // verifikasi bearer token
    const authorization = await verifyBearerToken(request);
    if (!authorization) return APIResponse.respondWithUnauthorized();
    const { userId, role } = authorization;

    // verifikasi role user
    if (role !== "customer")
      return APIResponse.respondWithForbidden(
        "Anda tidak memiliki akses untuk melakukan aksi ini!"
      );

    // cancel offer aplicant, atau cancel dari customer
    const result = await database
      .deleteFrom("offer_applicants")
      .where("customer", "=", authorization.userId as any)
      .where("offer", "=", offerId as any)
      .returning("id")
      .executeTakeFirstOrThrow();

    if (!result) {
      return APIResponse.respondWithConflict(
        "Tidak ada data yang dihapus karena tidak ada aplikasi yang ditemukan."
      );
    }
    return APIResponse.respondWithSuccess<DELETEResponse>({
      success: true,
      id: result.id,
    });
  } catch (e) {
    console.log(e);
    return APIResponse.respondWithServerError();
  }
}

interface PATCHResponse {
  success: boolean;
  id: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { offer_id: string } }
) {
  try {
    // verifikasi request user
    const { offer_id: offerId } = params;
    const validate = z
      .object({
        offerId: z
          .string({ required_error: "ID penawaran tidak boleh kosong!" })
          .min(1, "ID penawaran tidak boleh kosong!"),
      })
      .safeParse({ offerId });

    if (!validate.success)
      return APIResponse.respondWithBadRequest(
        validate.error.errors.map((it) => ({
          path: it.path[0] as string,
          message: it.message,
        }))
      );

    // verifikasi bearer token
    const authorization = await verifyBearerToken(request);
    if (!authorization) return APIResponse.respondWithUnauthorized();
    const { userId, role } = authorization;

    const json = await request.json();
    const {
      note,
      destination_location,
      pickup_location,
      pickup_latitude,
      pickup_longitude,
      destination_latitude,
      destination_longitude,
    } = json;
    const { offer_id } = params;

    const schema = z.object({
      note: z.string({
        required_error: "Catatan untuk pemesanan tidak boleh kosong!",
      }),
      destination_location: z.string({
        required_error: "Lokasi tujuan tidak boleh kosong!",
      }),
      pickup_location: z.string({
        required_error: "Lokasi penjemputan tidak boleh kosong!",
      }),
      pickup_latitude: z.number({
        required_error: "Latitude lokasi penjemputan tidak boleh kosong!",
      }),
      pickup_longitude: z.number({
        required_error: "Longitude lokasi penjemputan tidak boleh kosong!",
      }),
      destination_latitude: z.number({
        required_error: "Latitude lokasi tujuan tidak boleh kosong!",
      }),
      destination_longitude: z.number({
        required_error: "Longitude lokasi tujuan tidak boleh kosong!",
      }),
      offer_id: z.string().min(1, "Offer ID tidak boleh kosong!"),
    });

    const data = schema.safeParse({
      note,
      destination_location,
      pickup_location,
      pickup_latitude,
      pickup_longitude,
      destination_latitude,
      destination_longitude,
      offer_id,
    });

    if (!data.success) {
      return APIResponse.respondWithBadRequest(
        data.error.errors.map((it) => ({
          message: it.message,
          path: it.path[0] as string,
        }))
      );
    }

    // verifikasi role user
    if (authorization.role !== "customer") {
      return APIResponse.respondWithForbidden(
        "Anda tidak memiliki akses untuk melakukan aksi ini!"
      );
    }
    // Fetch the existing offer application from the database
    const existingApplication = await database
      .selectFrom("offer_applicants")
      .where("offer", "=", offerId as any)
      .where("customer", "=", userId as any)
      .select([
        "id",
        "note",
        "destination_location",
        "pickup_location",
        "pickup_latitude",
        "pickup_longitude",
        "destination_latitude",
        "destination_longitude",
      ])
      .executeTakeFirst();
    if (!existingApplication) {
      return APIResponse.respondWithNotFound("Aplikasi tidak ditemukan.");
    }

    // Update the offer application with the new data
    const result = await database
      .updateTable("offer_applicants")
      .set({
        note,
        destination_location,
        pickup_location,
        pickup_latitude,
        pickup_longitude,
        destination_latitude,
        destination_longitude,
      })
      .where("id", "=", existingApplication.id)
      .execute();

    if (!result) {
      return APIResponse.respondWithConflict("Gagal memperbarui aplikasi.");
    }
  } catch (e) {
    console.log(e);
    return APIResponse.respondWithServerError();
  }
}
